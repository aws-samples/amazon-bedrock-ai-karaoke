FROM arm64v8/python

WORKDIR /usr/src/app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

HEALTHCHECK CMD echo 1

COPY run.py .

CMD [ "python", "-u", "./run.py" ]