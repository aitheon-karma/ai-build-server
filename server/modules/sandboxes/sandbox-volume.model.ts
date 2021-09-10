import { Schema, Document, Model, model, Types } from 'mongoose';
import Db from '@aitheon/core-server/dist/config/db';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsString, IsNotEmpty, IsEnum, IsNumber, ValidateNested, IsMongoId, IsOptional, Min, IsDateString, IsBoolean } from 'class-validator';


/***
 * Data Transfer object type
 */
@JSONSchema({ description: 'SandboxVolume' })
export class SandboxVolume {

  @IsMongoId()
  _id: string;

  @IsString()
  user: string;

  @IsString()
  organization: string;

  @IsString()
  @IsOptional()
  terminatedAt: string;

  @IsNumber()
  size: number;

}

/**
 * Database schema/collection
 */
const sandboxVolumeSchema = new Schema({
  user: Schema.Types.ObjectId,
  organization: Schema.Types.ObjectId,
  terminatedAt: Date,
  size: Number
},
{
  timestamps: true,
  collection: 'build_server__sandbox_volumes'
});

export type ISandboxVolume = Document & SandboxVolume;
export const SandboxVolumeSchema = Db.connection.model<ISandboxVolume>('SandboxVolume', sandboxVolumeSchema);

