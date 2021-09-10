import { Schema, Document, Model, model, Types } from 'mongoose';
import Db from '@aitheon/core-server/dist/config/db';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsString, IsNotEmpty, IsEnum, IsNumber, ValidateNested, IsMongoId, IsOptional, Min, IsDateString } from 'class-validator';

/***
 * Data Transfer object type
 */
@JSONSchema({ description: 'Aitheon Service' })
export class Service {

  @IsString()
  @IsOptional()
  _id: string;

  @IsOptional()
  @IsString()
  @JSONSchema({ description: 'name of service' })
  name: string;

  @IsOptional()
  @IsString()
  @JSONSchema({ description: 'gitUrl of service' })
  gitUrl: string;

  @IsOptional()
  @IsString()
  @JSONSchema({ description: 'k8sNamespace of service' })
  k8sNamespace: string;

  @IsDateString()
  @IsOptional()
  createdAt: Date;

  @IsDateString()
  @IsOptional()
  updatedAt: Date;
}

/**
 * Database schema/collection
 */
const serviceSchema = new Schema({
  /**
   * Short key to be used for access detection and etc.
   */
  _id: {
    type: String,
    required: true
  },
  /**
   * Name of micro service
   */
  name: {
    type: String,
    required: true
  },
  /**
   * Helpful description of service
   */
  description: {
    type: String,
  },
  /**
   * Helpful url to service
   */
  url: String,
  /**
   * Icon class for css
   */
  iconClass: String,
  /**
   * Each service may depend on a list of dependencies
   */
  dependencies: [{
    type: String,
    ref: 'Service'
  }],
  /**
   * Type of service. Where it can be used
   */
  serviceType: {
    type: String,
    enum: ['personal', 'organization', 'any'],
    default: 'personal'
  },
  /**
   * Is service private and not see in general list
   */
  private: {
    type: Boolean,
    default: false
  },
  envStatus: {
    type: String,
    default: 'ALPHA',
    enum: [
      'ALPHA',
      'BETA',
      'PROD'
    ]
  },
  /**
   * Core service, Can't be disabled by user
   */
  core: {
    type: Boolean,
    default: false
  },
  /**
   * Show service at main navigation
   */
  showAtMenu: {
    type: Boolean,
    default: true
  },
  gitUrl: String,
  k8sNamespace: String
},
{
  timestamps: true,
});

export type IService = Document & Service;
export const ServiceSchema = Db.connection.model<IService>('Service', serviceSchema);

