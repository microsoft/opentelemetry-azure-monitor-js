> **This repository has been moved to the [Azure SDK for JavaScript](https://github.com/azure/azure-sdk-for-js/) repository.** In order to improve discoverability and share common dependencies & tests, the OpenTelemetry Azure Monitor for JS exporter has moved to the common location containing all Azure SDKs.


# Azure Monitor JavaScript Exporter for OpenTelemetry

[![npm version](https://badge.fury.io/js/%40azure%2Fmonitor-opentelemetry-exporter.svg)](https://badge.fury.io/js/%40azure%2Fmonitor-opentelemetry-exporter)
[![codecov](https://codecov.io/gh/microsoft/opentelemetry-azure-monitor-js/branch/master/graph/badge.svg)](https://codecov.io/gh/microsoft/opentelemetry-azure-monitor-js)
![Node.js CI](https://github.com/microsoft/opentelemetry-azure-monitor-js/workflows/Node.js%20CI/badge.svg)

## Getting Started

This exporter package assumes your application is [already instrumented](https://github.com/open-telemetry/opentelemetry-js/blob/master/getting-started/README.md) with the OpenTelemetry SDK. Once you are ready to export OpenTelemetry data, you can add this exporter to your application:

```zsh
npm install @azure/monitor-opentelemetry-exporter
```

### Distributed Tracing

Add the exporter to your existing OpenTelemetry tracer provider (`NodeTracerProvider` / `BasicTracerProvider`)

```js
const { AzureMonitorTraceExporter } = require('@azure/monitor-opentelemetry-exporter');
const { NodeTracerProvider } = require('@opentelemetry/node');
const { BatchSpanProcessor } = require('@opentelemetry/tracing');

// Use your existing provider
const provider = new NodeTracerProvider({
  plugins: {
    https: {
      // Ignore Application Insights Ingestion Server
      ignoreOutgoingUrls: [new RegExp(/dc.services.visualstudio.com/i)],
    },
  },
});
provider.register();

// Create an exporter instance
const exporter = new AzureMonitorTraceExporter({
  logger: provider.logger,
  instrumentationKey: 'ikey',
});

// Add the exporter to the provider
provider.addSpanProcessor(new BatchSpanProcessor(exporter, {
  bufferTimeout: 15000,
  bufferSize: 1000,
}));
```

### Metrics

Coming Soon

### Logs

Coming Soon

## Examples

Please take a look at the [examples](./examples) to see how to add the Azure Monitor Exporter to your existing OpenTelemetry instrumented project.


## Compiling This Project

```zsh
npm install
npm run build
npm run lint
npm run test
```

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
