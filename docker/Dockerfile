FROM node:8.10

ENV APP_HOME /var/www/app

# Install dependencies
RUN apt-get update -qq && \
    apt-get install -y \
      python \
      python-pip \
      python-dev

# Install aws cli
RUN pip install awscli

# Set the working directory
WORKDIR $APP_HOME

# Copy only package.json and yarn.lock for dependencies caching
ADD package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy application code
ADD . $APP_HOME