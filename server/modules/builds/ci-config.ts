export interface CIConfig {
  version: string;
  internal?: {
    stages?: string[],
    pushImage?: boolean,
    actions: {
      postBuild?: string[]
    }
  };
  resources?: {
    cpu: string,
    memory: string
  };
}