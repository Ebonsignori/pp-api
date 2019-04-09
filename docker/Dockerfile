FROM node:10.15.1-alpine

# Set working directory
RUN mkdir -p /usr/src
WORKDIR /usr/src

# Install packages
COPY ./package.json /usr/src
RUN npm install --quiet

COPY . /usr/src 
