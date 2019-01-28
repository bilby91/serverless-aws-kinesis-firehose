# kinesis-firehose-serverless-plugin

[Serverless framework](https://www.serverless.com) plugin to configure lambda functions to transform Kinesis Firehose delivery streams

## Installation

```bash
$ npm install --save kinesis-firehose-serverless-plugin
```

## Usage

Add the plugin to your `serverless.yml`

```yaml
# serverless.yml

plugins:
  - kinesis-firehose-serverless-plugin
```

Add a firehose event to your function

```yaml
# serverless.yml

functions:
  firehoseConsumer:
    handler: handler.consume
    events:
      - firehose:
          deliveryStreamName: my-delivery-stream
          numberOfRetries: '1'
          bufferSizeInMBs: '1' # Between 1.0 and 3
          bufferIntervalInSeconds: '900' # Between 60 and 900
```