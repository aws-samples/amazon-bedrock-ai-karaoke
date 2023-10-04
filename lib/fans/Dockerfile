FROM ubuntu:22.04

RUN apt-get update -y && \
    apt-get install -y --no-install-recommends \
        libraspberrypi-bin \
        gcc-aarch64-linux-gnu \
        python3-dev \
        python3-pip \
        python3 && \
    apt-get clean

COPY requirements.txt .
RUN pip3 install -r requirements.txt

COPY *.py .

CMD ["python3", "-u", "fans.py"]
