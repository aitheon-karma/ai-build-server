import { Schema, Document, Model, model, Types } from 'mongoose';
import Db from '@aitheon/core-server/dist/config/db';
import { JSONSchema } from 'class-validator-jsonschema';
import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsEnum, IsNumber, ValidateNested, IsMongoId, IsOptional, Min, IsDateString } from 'class-validator';

/***
 * Data Transfer object type
 */
@JSONSchema({ description: 'Sandbox Settings' })
export class SandboxSettings {

  @IsString()
  @IsOptional()
  _id: string;

  @IsString()
  sandboxVersion: string;

  @IsString()
  sandboxRunnerVersion: string;

  @IsNumber()
  defaultVolumeSize: number;

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
const sandboxSettingsSchema = new Schema({
  sandboxVersion: String,
  sandboxRunnerVersion: String,
  defaultVolumeSize: {
    type: Number,
    default: 20
  }
},
{
  timestamps: true,
  collection: 'build_server__sandbox_settings'
});

export type ISandboxSettings = Document & SandboxSettings;
export const SandboxSettingsSchema = Db.connection.model<ISandboxSettings>('SandboxSettings', sandboxSettingsSchema);

