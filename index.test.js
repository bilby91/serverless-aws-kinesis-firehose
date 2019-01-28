var KinesisFirehosePlugin = require('./index');

describe(KinesisFirehosePlugin, () => {
  let serverless;

  beforeEach(() => {
    serverless = {
      service: {
        functions: {
          func1: {
            function_key: 'func1',
            name: 'service-env-func1',
            events: [{ foo: { deliveryStreamName: 'my-stream' } }],
          },
          func2: {
            function_key: 'func2',
            name: 'service-env-func2',
            events: [
              {
                firehose: {
                  deliveryStreamName: 'my-stream',
                  numberOfRetries: '1',
                  bufferSizeInMBs: '2',
                  bufferIntervalInSeconds: '900',
                },
              },
            ],
          },
        },
      },
    };
  });

  describe('validateSchema', () => {
    it("doesn't throw an error when schema is valid", () => {
      const plugin = new KinesisFirehosePlugin(serverless);
      expect(plugin.validateSchema()).resolves.not.toThrowError();
    });

    it('throw an error when schema is missing deliveryStreamName', () => {
      delete serverless.service.functions.func2.events[0].firehose.deliveryStreamName;

      const plugin = new KinesisFirehosePlugin(serverless);

      expect(plugin.validateSchema()).resolves.toThrowError();
    });
  });

  describe('attachLambdaToFirehose', () => {
    let plugin;

    beforeEach(() => {
      plugin = new KinesisFirehosePlugin(serverless);

      plugin.lambda.getFunction = jest.fn(({ FunctionName }) => {
        return {
          promise: () =>
            Promise.resolve({
              Configuration: {
                FunctionArn: `arn:aws:lambda:us-east-1:11111:function:${FunctionName}`,
              },
            }),
        };
      });

      plugin.firehose.describeDeliveryStream = jest.fn(({ DeliveryStreamName }) => {
        return {
          promise: () =>
            Promise.resolve({
              DeliveryStreamDescription: {
                VersionId: '1',
                Destinations: [{ DestinationId: 'destinationId-000000000001' }],
              },
            }),
        };
      });

      plugin.firehose.updateDestination = jest.fn(() => {
        return {
          promise: () => Promise.resolve({}),
        };
      });
    });

    it('call aws lambda service to get the function arn', async () => {
      await plugin.attachLambdaToFirehose();

      expect(plugin.lambda.getFunction).toHaveBeenCalledWith({
        FunctionName: 'service-env-func2',
      });
    });

    it('call aws firehose service to get the stream information', async () => {
      await plugin.attachLambdaToFirehose();

      expect(plugin.firehose.describeDeliveryStream).toHaveBeenCalledWith({
        DeliveryStreamName: 'my-stream',
      });
    });

    it('call aws firehose service to update the stream processor', async () => {
      await plugin.attachLambdaToFirehose();

      expect(plugin.firehose.updateDestination).toHaveBeenCalledWith({
        DeliveryStreamName: 'my-stream',
        CurrentDeliveryStreamVersionId: '1',
        DestinationId: 'destinationId-000000000001',
        ExtendedS3DestinationUpdate: {
          ProcessingConfiguration: {
            Enabled: true,
            Processors: [
              {
                Type: 'Lambda',
                Parameters: [
                  {
                    ParameterName: 'LambdaArn',
                    ParameterValue: 'arn:aws:lambda:us-east-1:11111:function:service-env-func2',
                  },
                  {
                    ParameterName: 'NumberOfRetries',
                    ParameterValue: '1',
                  },
                  {
                    ParameterName: 'BufferSizeInMBs',
                    ParameterValue: '2',
                  },
                  {
                    ParameterName: 'BufferIntervalInSeconds',
                    ParameterValue: '900',
                  },
                ],
              },
            ],
          },
        },
      });
    });
  });
});
