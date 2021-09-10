import { Schema, Document, Model, model, Types } from 'mongoose';
import Db from '@aitheon/core-server/dist/config/db';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsString, IsNotEmpty, IsEnum, IsNumber, ValidateNested, IsMongoId, IsOptional, Min, IsDateString, IsBoolean } from 'class-validator';


export enum SimulatorType {
  NODEJS = 'NODEJS',
  GAZEBO = 'GAZEBO',
  ISAAC = 'ISAAC'
}

export enum SimulatorStatus {
  NOT_RUNNING = 'NOT_RUNNING',
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR',
}

/***
 * Data Transfer object type
 */
@JSONSchema({ description: 'Simulator of users service' })
export class Simulator {

  @IsMongoId()
  @IsOptional()
  _id: string;

  @IsOptional()
  @IsString()
  @JSONSchema({ description: 'Name' })
  name: string;

  @IsOptional()
  @IsString()
  @JSONSchema({ description: 'Creators studio project' })
  project: any;

  @IsOptional()
  @IsString()
  @JSONSchema({ description: 'SessionId' })
  sessionId: string;

  @IsOptional()
  @IsString()
  @JSONSchema({ description: 'deviceId' })
  deviceId: string;

  @IsNotEmpty()
  @IsEnum(SimulatorType)
  @JSONSchema({ description: 'Simulator Type' })
  type: SimulatorType;

  @IsNotEmpty()
  @IsEnum(SimulatorStatus)
  @JSONSchema({ description: 'Simulator Status' })
  status: SimulatorStatus;

  @IsDateString()
  @IsOptional()
  updatedAt: Date;

  @IsDateString()
  @IsOptional()
  createdAt: Date;
}

/**
 * Database schema/collection
 */
const simulatorSchema = new Schema({
  project: {
    type: Schema.Types.ObjectId
  },
  sessionId: String,
  deviceId: Schema.Types.ObjectId,
  type: {
    type: String,
    enum: Object.keys(SimulatorType)
  },
  status: {
    type: String,
    enum: Object.keys(SimulatorStatus)
  },
},
{
  timestamps: true,
  collection: 'build_server__simulators'
});

export type ISimulator = Document & Simulator;
export const SimulatorSchema = Db.connection.model<ISimulator>('Simulator', simulatorSchema);