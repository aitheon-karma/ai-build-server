
import { Service, Inject } from 'typedi';
import Db from '@aitheon/core-server/dist/config/db';
import { generate } from 'generate-password';
import { ProjectDBSchema } from './project-db.model';

@Service()
export class ProjectDBsService {

  constructor() {
  }

  async ensureDbConnection(projectId: string) {
    let projectDb = await ProjectDBSchema.findOne({ project: projectId });
    if (!projectDb) {
      projectDb = await this.generateDbConnection('project', projectId, undefined);
    }
    return projectDb;
  }

  async ensureDbConnectionByGraphNode(graphNode: string) {
    let projectDb = await ProjectDBSchema.findOne({ graphNode: graphNode });
    if (!projectDb) {
      projectDb = await this.generateDbConnection('graph-node', undefined, graphNode);
    }
    return projectDb;
  }

  async generateDbConnection(prefix: string, project: string, graphNode: string) {
    const uniqueId = project || graphNode;
    const projectDb = new ProjectDBSchema({
      name: `${ prefix }-${ uniqueId }`,
      project,
      graphNode,
      username: generate({
        length: 20,
        numbers: true,
        symbols: false,
        uppercase: true,
        excludeSimilarCharacters: true
      }),
      password: generate({
        length: 20, // randomize length between 10 and 20 characters
        numbers: true,
        symbols: false,
        uppercase: true,
        excludeSimilarCharacters: false
      })
    });
    await projectDb.save();

    const options = {
      fsync: false,
      roles: [{ 'role': 'readWrite', 'db': projectDb.name }]
    };
    await Db.connection.db.admin().addUser(projectDb.username, projectDb.password, options);
    return projectDb;
  }

}
