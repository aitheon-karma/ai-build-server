import { Get, Post, Delete, Put, Body, Param, Res, Req, JsonController, getMetadataArgsStorage, Authorized, CurrentUser, QueryParam, Params, HttpCode } from 'routing-controllers';
import { Inject } from 'typedi';
import { Request, Response } from 'express';
import { Current, logger } from '@aitheon/core-server';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
const child = require('child_process');
import * as _ from 'lodash';
import * as shelljs from 'shelljs';

@Authorized()
@JsonController('/api/libs')
export class LibsController {

  @Get('/aitheon')
  @OpenAPI({
    description: 'List of Aitheon libs'
  })
  async list(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request) {
    // const server = await this.lsAi('npm ls --depth=0 --json;');
    // const client = await this.lsAi('cd client; npm ls --depth=0 --json;');
    // const serverAi = Object.keys(server.dependencies).filter(dep => dep.includes('@aitheon')).map(dep => server.dependencies[dep]);
    // const clientAi = Object.keys(client.dependencies).filter(dep => dep.includes('@aitheon')).map(dep => client.dependencies[dep]);
    // const result = [...serverAi, ...clientAi];

    // 1. Request by http all services https://dev.aitheon.com/users/api/services
    // 1.1 As lib name use service.k8sNamespace but .replace('ai-', '') to get proper name, from ai-treasury just treasury
    // 2. Request each https://registry.npmjs.org/@aitheon/treasury with header Authorization Bearer ${ env npm token}
    // 2.1 if error or not found don't display this lib/service
    // 2.2 also request this static lib from npm 'core-client', core-server, ui-widgets
    // 3. show latest version Number from npm response  "dist-tags": { "latest": "0.4.0"},
    // 4. At client side On library version. Must redirect user to url, example for template https://dev.aitheon.com/template/docs/index.html

    return response.json([]);
  }

  async lsAi(lsPath: string): Promise<any> {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const result = await shelljs.exec(lsPath, { async: true });
        result.stdout.on('data', (data) => {
          const libs = JSON.parse(data);
          resolve(libs);
        });
      } catch (err) {
        reject();
      }
    });
  }

}
