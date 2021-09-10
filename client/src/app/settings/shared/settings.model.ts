export class Settings {
    _id?: string;
    buildType: BuildType;
    maxParallel: number;
    languages: string[];

    dockerFile: string;

  }

  export enum BuildType {
    AITHEON_SERVICE = 'AITHEON_SERVICE',
    USER_SERVICE = 'USER_SERVICE'
  }

  export enum Language {
    JAVASCRIPT = 'JAVASCRIPT',
    PYTHON = 'PYTHON',
    BLOCKLY = 'BLOCKLY',
    C = 'C',
    CPP = 'C++',
  }
