import { Schema, Document, Model, model, Types } from 'mongoose';
import Db from '@aitheon/core-server/dist/config/db';

/***
 * Example Type. Data Transfer object type
 */
export type ProjectDB = Document & {
  name: string,
  username: string,
  password: string,
  project: any,
  graphNode: any
};

/**
 * Database schema/collection
 */
const projectDBSchema = new Schema({
  name: String,
  username: String,
  password: String,
  project: {
    type: Schema.Types.ObjectId,
  },
  graphNode: {
    type: Schema.Types.Mixed,
  }
},
{
  timestamps: true,
  collection: 'build_server__projects_db'
});


export const ProjectDBSchema = Db.connection.model<ProjectDB>('ProjectDB', projectDBSchema);
