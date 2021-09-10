import { Schema, Document, Model, model, Types } from 'mongoose';
import Db from '@aitheon/core-server/dist/config/db';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsString, IsNotEmpty, IsEnum, IsNumber, ValidateNested, IsMongoId, IsOptional, Min, IsDateString, IsBoolean } from 'class-validator';


@JSONSchema({ description: 'SandboxResource' })
export class SandboxResource {
  @IsNumber()
  cpu: number;

  @IsString()
  memory: string;

  @IsString()
  storage: string;
}
/***
 * Data Transfer object type
 */
@JSONSchema({ description: 'SandboxType' })
export class SandboxType {

  @IsMongoId()
  _id: string;

  @IsString()
  displayText: string;

  @IsString()
  description: string;

  @IsString()
  image: string;

  @IsString()
  nodeSelector: string;

  @IsNumber()
  hotLoadedCount: number;

  @ValidateNested()
  resource: SandboxResource;

  @IsBoolean()
  disabled: boolean;
}

/**
 * Database schema/collection
 */
const sandboxTypeSchema = new Schema({
  displayText: String,
  description: String,
  image: String,
  nodeSelector: String,
  hotLoadedCount: {
    type: Number,
    default: 0
  },
  resource: {
    cpu: Number,
    memory: String,
    storage: String,
  },
  disabled: {
    type: Boolean,
    default: false
  }
},
{
  timestamps: true,
  collection: 'build_server__sandbox_types'
});

export type ISandboxType = Document & SandboxType;
export const SandboxTypeSchema = Db.connection.model<ISandboxType>('SandboxType', sandboxTypeSchema);

