const DEFAULT_HTTP_PORT = 3000;
const MAXIMUM_TCP_PORT = 65_535;

export const getHttpPort = (
  configuredPort: string | number | undefined,
): number => {
  if (
    configuredPort === undefined ||
    (typeof configuredPort === 'string' && !configuredPort.trim())
  ) {
    return DEFAULT_HTTP_PORT;
  }

  const port = Number(configuredPort);

  if (!Number.isSafeInteger(port) || port < 1 || port > MAXIMUM_TCP_PORT) {
    throw new Error('PORT doit etre un entier compris entre 1 et 65535.');
  }

  return port;
};
