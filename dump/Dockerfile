FROM postgres:10

RUN apt-get update
RUN apt-get install python-pip --yes
RUN pip install awscli --upgrade --user

WORKDIR /postgres-dump
COPY postgres-dump-to-s3.sh .
RUN chmod +x postgres-dump-to-s3.sh

ENV PATH="~/.local/bin:/postgres-dump:${PATH}"