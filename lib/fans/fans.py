from RPi import GPIO
import time
import subprocess

# Constants
FAN_PINS = [14, 26]
PWM_FREQUENCY = 100
TEMP_THRESHOLDS = [75, 70, 60, 50, 40, 30]
FAN_SPEEDS = [100, 85, 70, 50, 25, 15, 0]
SLEEP_TIME = 5

def get_temp():
    """
    Retrieves the CPU temperature of the Raspberry Pi.
    
    :return: CPU temperature as float
    :raises RuntimeError: if temperature retrieval fails
    """
    output = subprocess.run(['vcgencmd', 'measure_temp'], capture_output=True)
    temp_str = output.stdout.decode()
    try:
        return float(temp_str.split('=')[1].split("'")[0])
    except (IndexError, ValueError):
        raise RuntimeError('Could not parse temperature. Output: {}'.format(temp_str))

def set_fan_speed(fans, speed):
    """
    Sets the duty cycle for all fan PWM channels.
    
    :param fans: List of fan PWM channels
    :param speed: Duty cycle to set for the fans
    """
    for fan in fans:
        fan.ChangeDutyCycle(speed)

def main():
    GPIO.setwarnings(False)
    GPIO.setmode(GPIO.BCM)
    
    fans = []
    for pin in FAN_PINS:
        GPIO.setup(pin, GPIO.OUT)
        fans.append(GPIO.PWM(pin, PWM_FREQUENCY))
    
    for fan in fans:
        fan.start(100)

    try:
        print("Starting fan control loop")
        while True:
            temp = get_temp()
            for i, threshold in enumerate(TEMP_THRESHOLDS):
                if temp > threshold:
                    set_fan_speed(fans, FAN_SPEEDS[i])
                    break
            time.sleep(SLEEP_TIME)
    except KeyboardInterrupt:
        pass
    finally:
        for fan in fans:
            fan.stop()
        GPIO.cleanup()

if __name__ == "__main__":
    main()
