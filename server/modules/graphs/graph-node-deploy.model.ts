import { Schema, Document, Model, model, Types } from 'mongoose';
import Db from '@aitheon/core-server/dist/config/db';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsString, IsNotEmpty, IsEnum, IsNumber, ValidateNested, IsMongoId, IsOptional, Min, IsDateString, IsBoolean } from 'class-validator';

@JSONSchema({ description: 'GraphNodeDeploy' })
export class GraphNodeDeploy {

  @IsMongoId()
  _id: string;

  @IsMongoId()
  organization: string;

  @IsMongoId()
  graph: string;

  @IsMongoId()
  graphNode: string;

  @IsString()
  releaseHash: string;

  @IsMongoId()
  release: string;

  @IsMongoId()
  project: string;

  @IsOptional()
  @IsMongoId()
  device: string;

  @IsOptional()
  @IsBoolean()
  deviceDeployment: boolean;
}

/**
 * Database schema/collection
 */
const graphNodeDeploySchema = new Schema({
  organization: Schema.Types.ObjectId,
  graph: Schema.Types.ObjectId,
  graphNode: Schema.Types.ObjectId,
  release: Schema.Types.ObjectId,
  project: Schema.Types.ObjectId,
  releaseHash: String,
  device: Schema.Types.ObjectId,
  deviceDeployment: {
    type: Boolean,
    default: false
  },
},
{
  timestamps: true,
  collection: 'build_server__graph_node_deploys'
});

export type IGraphNodeDeploy = Document & GraphNodeDeploy;
export const GraphNodeDeploySchema = Db.connection.model<IGraphNodeDeploy>('GraphNodeDeploy', graphNodeDeploySchema);

