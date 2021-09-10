import { Schema, Document, Model, model, Types } from 'mongoose';
import Db from '@aitheon/core-server/dist/config/db';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsString, IsNotEmpty, IsEnum, IsNumber, ValidateNested, IsMongoId, IsOptional, Min, IsDateString, IsBoolean, IsArray } from 'class-validator';
import { Service } from '../services/service.model';
import { CIConfig } from './ci-config';

export enum BuildType {
  AITHEON_SERVICE = 'AITHEON_SERVICE',
  USER_SERVICE = 'USER_SERVICE',
  USER_LIB = 'USER_LIB',
  AITHEON_LIB = 'AITHEON_LIB'
}

export enum BuildStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  CANCELED = 'CANCELED',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS'
}

/***
 * Data Transfer object type
 */
@JSONSchema({ description: 'Build of Aitheon Service, User Service and etc.' })
export class Build {

  @IsMongoId()
  @IsOptional()
  _id: string;

  @IsOptional()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEnum(BuildType)
  @JSONSchema({ description: 'Type of build' })
  type: BuildType;

  @IsOptional()
  @IsString()
  @IsArray()
  @JSONSchema({ description: 'Output of build' })
  output: Array<string>;

  @IsOptional()
  @IsString()
  @JSONSchema({ description: 'Aitheon service ref' })
  service: Service;

  @IsOptional()
  @IsString()
  @JSONSchema({ description: 'Creators studio project' })
  project: any;

  @IsOptional()
  @IsString()
  @JSONSchema({ description: 'Additional path' })
  ingressSlug: String;

  @IsOptional()
  @IsString()
  @JSONSchema({ description: 'Npm client lib name' })
  npmClientLibName: String;

  @IsOptional()
  @IsString()
  @JSONSchema({ description: 'Npm lib name' })
  npmLibName: string;

  @IsOptional()
  @IsString()
  @JSONSchema({ description: 'Git Url' })
  gitUrl: string;

  @IsOptional()
  @IsString()
  @JSONSchema({ description: 'Head Commit' })
  headCommit: string;

  @IsOptional()
  @IsString()
  @JSONSchema({ description: 'Git branch' })
  gitBranch: string;

  @IsOptional()
  @IsString()
  @JSONSchema({ description: 'Image name at reqistery' })
  imageName: string;

  @IsOptional()
  @IsString()
  @JSONSchema({ description: 'Full image name at reqistery' })
  fullImageName: string;

  @IsNotEmpty()
  @IsEnum(BuildStatus)
  @JSONSchema({ description: 'Status of build' })
  status: BuildStatus;

  @IsDateString()
  @IsOptional()
  createdAt: Date;

  @IsDateString()
  @IsOptional()
  startDate: Date;

  @IsDateString()
  @IsOptional()
  endDate: Date;

  @IsOptional()
  @IsString()
  k8sNamespace: string;

  @IsOptional()
  @IsBoolean()
  imagePushed: boolean;

  @IsDateString()
  @IsOptional()
  updatedAt: Date;

  @IsOptional()
  @IsString()
  sessionId: String;

  @IsOptional()
  @IsString()
  @IsArray()
  notifyEmails: Array<String>;

  @IsOptional()
  @IsNumber()
  maxTries: number;

  @IsOptional()
  @IsBoolean()
  requireDeploy: boolean;

  @IsOptional()
  @IsBoolean()
  artifactsBuild: boolean;

  @IsOptional()
  @IsString()
  artifactsUrl: string;

  @IsOptional()
  @IsBoolean()
  artifactsPushed: boolean;

  ssh: {
    privateKey: string,
    publicKey: string
  };

  dockerfile: string;

  transporter: {
    inputsNode: Array<any>,
    outputsNode: Array<any>,
    inputsService: Array<any>,
    outputsService: Array<any>,
    events: Array<any>,
    actions: Array<any>,
    ticks: Array<any>,
    settingParams: Array<any>,
    nodeChannels: Array<any>,
  };

  ciConfig: CIConfig;

  projectSpec: {
    projectType: string;
    language: string;
    slug: string;
  };
}

/**
 * Database schema/collection
 */
const buildSchema = new Schema({
  name: String,
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: Object.keys(BuildType)
  },
  service: {
    type: String,
    ref: 'Service'
  },
  project: {
    type: Schema.Types.ObjectId
  },
  // TODO: move to project object
  projectSpec: {
    projectType: String,
    language: String,
    slug: String
  },
  ingressSlug: String,
  npmClientLibName: String,
  npmLibName: String,
  gitUrl: String,
  gitBranch: String,
  headCommit: String,
  imageName: String,
  fullImageName: String,
  output: [String],
  status: {
    type: String,
    enum: Object.keys(BuildStatus)
  },
  k8sNamespace: String,
  startDate: Date,
  endDate: Date,
  sessionId: String,
  imagePushed: {
    type: Boolean,
    default: false
  },
  notifyEmails: [String],
  maxTries: {
    type: Number,
    default: 1
  },
  requireDeploy: {
    type: Boolean,
    default: true
  },
  artifactsBuild: {
    type: Boolean,
    default: false
  },
  artifactsUrl: {
    type: String
  },
  artifactsPushed: {
    type: Boolean,
    default: false
  },
  ssh: {
    privateKey: String,
    publicKey: String
  },
  dockerfile: String,
  transporter: {
    inputsNode: Schema.Types.Mixed,
    outputsNode: Schema.Types.Mixed,
    inputsService: Schema.Types.Mixed,
    outputsService: Schema.Types.Mixed,
    events: Schema.Types.Mixed,
    actions: Schema.Types.Mixed,
    ticks: Schema.Types.Mixed,
    settingParams: Schema.Types.Mixed,
    nodeChannels: Schema.Types.Mixed,
    deviceReceiver: Boolean,
    deviceSender: Boolean
  },
  ciConfig: Schema.Types.Mixed
},
{
  timestamps: true,
  collection: 'build_server__builds',
  toJSON: {
    transform: function (doc, ret) {
      delete ret.ssh;
      delete ret.dockerfile;
    }
  }
});

export type IBuild = Document & Build;
export const BuildSchema = Db.connection.model<IBuild>('Build', buildSchema);
