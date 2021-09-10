import { Schema, Document, Model, model, Types } from 'mongoose';
import Db from '@aitheon/core-server/dist/config/db';
import { JSONSchema } from 'class-validator-jsonschema';
import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsEnum, IsNumber, ValidateNested, IsMongoId, IsOptional, Min, IsDateString, IsBoolean } from 'class-validator';
import { SandboxType } from './sandbox-type.model';
import { boolean } from '@aitheon/transporter';

/***
 * Data Transfer object type
 */
@JSONSchema({ description: 'Sandbox Hot Template' })
export class SandboxHotTemplate {

  @IsString()
  @IsOptional()
  _id: string;

  @ValidateNested()
  @Type(() => SandboxType)
  type: SandboxType;

  @IsString()
  sandboxVersion: string;

  @IsString()
  sandboxRunnerVersion: string;

  @IsString()
  status: string;

  @IsDateString()
  @IsOptional()
  createdAt: Date;

  @IsDateString()
  @IsOptional()
  updatedAt: Date;

  @IsBoolean()
  allocated: boolean;
}

/**
 * Database schema/collection
 */
const sandboxHotTemplateSchema = new Schema({
  type: {
    type: Schema.Types.ObjectId,
    ref: 'SandboxType'
  },
  sandboxVersion: String,
  sandboxRunnerVersion: String,
  status: String,
  allocated: Boolean
},
{
  timestamps: true,
  collection: 'build_server__sandbox_hot_templates'
});

export type ISandboxHotTemplate = Document & SandboxHotTemplate;
export const SandboxHotTemplateSchema = Db.connection.model<ISandboxHotTemplate>('SandboxHotTemplate', sandboxHotTemplateSchema);

