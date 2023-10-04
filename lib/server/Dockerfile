FROM ubuntu:22.04

RUN apt-get update -y && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-dev \
        gcc-aarch64-linux-gnu \
        sudo \
        vim \
        python3-pyaudio \
        fbi \
        alsa-base \
        alsa-utils \
        libpulse0 \
        libasound2 \
        libasound2-plugins \
        git \
        libsndfile1-dev && \
    apt-get clean

COPY requirements.txt .
RUN pip3 install -r requirements.txt

HEALTHCHECK CMD echo 1

COPY *.py .
COPY prompts.json .
RUN mkdir -p /results

CMD ["python3", "-u", "server.py"]
