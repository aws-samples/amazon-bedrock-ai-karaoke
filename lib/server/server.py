#!/usr/bin/env python

import asyncio
from functools import partial

import json
import datetime
from websockets import serve, exceptions, connect

import os
import sounddevice

from amazon_transcribe.client import TranscribeStreamingClient
from amazon_transcribe.handlers import TranscriptResultStreamHandler
from amazon_transcribe.model import TranscriptEvent

from states import State
from server_state import ServerState

try:
    import RPi.GPIO as GPIO
except ImportError:
    print("RPi.GPIO module is not available. Using mouse click instead.")
    # You can use a mock or a dummy module as a fallback
    GPIO = None  # or some mock object

## Uncomment this to see all websocket messages
# import logging
# logger = logging.getLogger('websockets')
# logger.setLevel(logging.DEBUG)
# logger.addHandler(logging.StreamHandler())

WEBSOCKET_PORT = 8765           # Standard websocket port
WEBSOCKET_IP = '127.0.0.1'      # Interface for websocket server to listen on
POLL_DELAY = 0.1                # How long to pause between sending websocket data.
MIC_SAMPLE_RATE_HZ = 48000      # This may change depending on your microphone

aws_region = os.getenv("AWS_DEFAULT_REGION", "us-east-1")
language_code = os.getenv("LANGUAGE_CODE", "en-US")
vocab_filter_name = os.getenv("VOCAB_FILTER_NAME", "BadWords-AiKaraokeStack")
vocab_filter_method = os.getenv("VOCAB_FILTER_METHOD", "mask")

class MyEventHandler(TranscriptResultStreamHandler):

    def __init__(self, stream, server_state):
        super().__init__(stream)
        self.server_state = server_state

    async def modify_string(self, s):
        """Remove the capitals and full stop from the punctuated output from Amazon Transcribe"""
        #TODO - Handle proper nouns so they remain capitalised
        first_cap_to_lower = ''
        full_stop_removed = ''
        
        # Convert the first capital letter to lowercase
        for i, c in enumerate(s):
            if c.isupper():
                first_cap_to_lower = s[:i] + c.lower() + s[i+1:]
                break
        else:  # No capital letter found
            first_cap_to_lower = s
        
        # Remove last full stop
        if first_cap_to_lower and first_cap_to_lower[-1] == '.':
            full_stop_removed = first_cap_to_lower[:-1]
        else:  # No full stop found
            full_stop_removed = first_cap_to_lower
        
        return full_stop_removed

    async def handle_transcript_event(self, transcript_event: TranscriptEvent):
        """Handle transcript events asyncronously."""
        results = transcript_event.transcript.results
        
        for result in results:
            if not result.is_partial:
                if '_' in self.server_state.my_prompt:
                    snippet = await self.modify_string(result.alternatives[0].transcript)
                    self.server_state.my_prompt = self.server_state.my_prompt.replace('_', snippet, 1)
                    print("Prompt:", self.server_state.my_prompt)

                if '_' in self.server_state.my_prompt:
                    break
                else:
                    await asyncio.to_thread(self.server_state.handle_generation)
                    break
    
async def mic_stream(server_state):
    """This function wraps the raw input stream from the microphone 
    forwarding the blocks to an asyncio.Queue."""
    loop = asyncio.get_event_loop()
    # loop.set_debug(True)  # Enable debug
    input_queue = asyncio.Queue()

    def callback(indata, frame_count, time_info, status):
        # Only put audio on queue if state is transcribing - to avoid queuing up chit chat while looking at the image
        if (server_state.my_state == State.TRANSCRIBING):
            loop.call_soon_threadsafe(
                input_queue.put_nowait, (bytes(indata), status))

    # Be sure to use the correct parameters for the audio stream that matches
    # the audio formats described for the source language you'll be using:
    # https://docs.aws.amazon.com/transcribe/latest/dg/streaming.html
    sd_stream = sounddevice.RawInputStream(
        channels=1,
        samplerate=MIC_SAMPLE_RATE_HZ,
        callback=callback,
        blocksize=1024 * 2,
        dtype="int16"
    )
    print(f"Transcribing with sample rate {sd_stream.samplerate} device {sd_stream.device}")
    # Initiate the audio stream and asynchronously yield the audio chunks as they become available.
    with sd_stream:
        while True:
            indata, status = await input_queue.get()
            yield indata, status

async def write_chunks(stream, server_state):
    """This connects the raw audio chunks generator coming from the microphone 
    and passes them along to the transcription stream."""
    async for chunk, status in mic_stream(server_state):
        await stream.input_stream.send_audio_event(audio_chunk=chunk)
    await stream.input_stream.end_stream()


async def basic_transcribe(server_state):
    """Setup transcription client."""
    # Setup up our client with our chosen AWS region
    client = TranscribeStreamingClient(region=aws_region)

    # Start transcription to generate our async stream
    transcribe_stream = await client.start_stream_transcription(
        language_code=language_code,
        media_sample_rate_hz=MIC_SAMPLE_RATE_HZ,
        media_encoding="pcm",
        vocab_filter_name=vocab_filter_name,
        vocab_filter_method=vocab_filter_method
    )

    # Instantiate our handler and start processing events
    handler = MyEventHandler(transcribe_stream.output_stream, server_state)
    try:
        await asyncio.gather(write_chunks(transcribe_stream, server_state),handler.handle_events())
    except Exception as error:
        await transcribe_stream.input_stream.end_stream()
        server_state.my_state = State.ERROR
        server_state.my_error = str(error)
        server_state.my_error_time = datetime.datetime.now().timestamp()
        print(f"ERROR: {server_state.my_error}")

async def consumer_handler(websocket, server_state):
    async for message in websocket:
        if message == "A":
            server_state.red_button_callback(None)
        elif message == "B":
            server_state.blue_button_callback(None)
        else:
            print(f'Unknown message {message}')

async def producer_handler(websocket, server_state):
    previous_data = None

    while True:        
        try:
            data = {
                "event_time": str(datetime.datetime.now()),
                "prompt": server_state.my_prompt,
                "model": server_state.my_model,
                "result_a": server_state.my_result_a,
                "result_b": server_state.my_result_b,
                "state": str(server_state.my_state),
                "error": server_state.my_error
            }
            # Only send the message if the data has changed
            if data != previous_data:
                await websocket.send(json.dumps(data))

        except exceptions.ConnectionClosed \
                or exceptions.ConnectionClosedOK \
                or exceptions.ConnectionClosedError \
                or KeyboardInterrupt as e:
            print(e)
        await asyncio.sleep(POLL_DELAY)

async def handler(websocket, server_state):
    await asyncio.gather(
        consumer_handler(websocket, server_state),
        producer_handler(websocket, server_state),
    )

async def poll_handler(server_state):
    """Handle the GPIO button presses and restarting transcription after errors"""
    server_state.my_task = asyncio.create_task(basic_transcribe(server_state))

    while True:
        try:
            time_now = datetime.datetime.now().timestamp()

            if server_state.my_state == State.ERROR and (time_now - server_state.my_error_time) > 20:
                print("Starting again after 30 seconds after an error.")
                server_state.get_next_prompt()
                if server_state.my_task:
                    server_state.my_task.cancel()
                    server_state.my_task = asyncio.create_task(basic_transcribe(server_state))
                    
            if server_state.my_state == State.REVIEW_TXT or server_state.my_state == State.REVIEW_IMG:
                try:
                    print("Waiting for button press.")
                    while True:
                        if server_state.button_pressed:
                            await asyncio.sleep(1)
                            server_state.save_results()
                            if server_state.my_task:
                                server_state.my_task.cancel()
                            server_state.my_task = asyncio.create_task(basic_transcribe(server_state))
                            break
                        else: 
                            await asyncio.sleep(0.2)

                except KeyboardInterrupt:
                    print("Exiting program.")

            await asyncio.sleep(0.2)
        
        except Exception as error:
            print(error)
            server_state.my_error = str(error)
            server_state.my_error_time = datetime.datetime.now().timestamp()
            server_state.my_state = State.ERROR
            continue

async def main():
    """Main method to initialize and run the server."""
    server_state = ServerState()
    # Create a partial function for producer_handler with server_state
    handler_with_state = partial(handler, server_state=server_state)

    try:
        # Initialize GPIO
        if GPIO is not None:
            in_review = True
            GPIO.setmode(GPIO.BCM)  # Use BCM numbering scheme
            GPIO.setwarnings(False) # Disable warnings

            # Pin configuration
            red_button_pin = 16
            blue_button_pin = 17

            # Set up the button pins as input pins with pull-up resistors
            GPIO.setup(red_button_pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
            GPIO.setup(blue_button_pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)

            # Register the button press events
            GPIO.add_event_detect(red_button_pin, GPIO.FALLING, callback=server_state.red_button_callback, bouncetime=600)
            GPIO.add_event_detect(blue_button_pin, GPIO.FALLING, callback=server_state.blue_button_callback, bouncetime=600)
        else:
            print("GPIO is not available. Skipping setup.")
        
    except Exception as error:
        print(error)
        
    # Schedule these calls *concurrently*:
    await asyncio.gather(
        poll_handler(server_state),
        serve(handler_with_state, WEBSOCKET_IP, WEBSOCKET_PORT)
    )

    if GPIO is not None:
        GPIO.cleanup()  # Clean up GPIO settings

if __name__ == "__main__":
    asyncio.run(main())
