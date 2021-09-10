import { Schema, Document, Model, model, Types } from 'mongoose';
import Db from '@aitheon/core-server/dist/config/db';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsString, IsNotEmpty, IsEnum, IsNumber, ValidateNested, IsMongoId, IsOptional, Min, IsDateString, IsArray } from 'class-validator';
import { BuildType } from '../builds/build.model';


export enum Language {
  JAVASCRIPT = 'JAVASCRIPT',
  PYTHON = 'PYTHON',
  BLOCKLY = 'BLOCKLY',
  C = 'C',
  CPP = 'C++',
}

/***
 * Data Transfer object type
 */
@JSONSchema({ description: 'Settings of build of Aitheon Service, User Service and etc.' })
export class Settings {

  @IsMongoId()
  @IsOptional()
  _id: string;


  @IsNotEmpty()
  @IsEnum(BuildType)
  @JSONSchema({ description: 'Type of build' })
  buildType: BuildType;

  @IsOptional()
  @IsNumber()
  @JSONSchema({ description: 'Max parallels' })
  maxParallel: number;

  @IsOptional()
  @IsArray()
  @JSONSchema({ description: 'List of languages' })
  languages: Array<Language>;

  @IsOptional()
  @IsString()
  @JSONSchema({ description: 'Docker file' })
  dockerFile: String;

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
const settingsSchema = new Schema({
  buildType: {
    type: String,
    enum: Object.keys(BuildType)
  },
  maxParallel: {
    type: Number,
    min: 1,
    default: 1
  },
  languages: [String],
  dockerFile: String
},
{
  timestamps: true,
  collection: 'build_server__settings'
});

export type ISettings = Document & Settings;
export const SettingsSchema = Db.connection.model<ISettings>('Settings', settingsSchema);