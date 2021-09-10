import { Get, Post, Delete, Put, Body, Param, Res, Req, JsonController, getMetadataArgsStorage, Authorized, CurrentUser, QueryParam, Params, HttpCode } from 'routing-controllers';
import { Inject } from 'typedi';
import { BuildsService } from './builds.service';
import { Build, BuildSchema, BuildType } from './build.model';
import { Request, Response } from 'express';
import { Current, logger, hasDeveloperAccess } from '@aitheon/core-server';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { ServicesService } from '../services/services.service';
import { environment } from '../../environment';
import * as crypto from 'crypto';
import * as _ from 'lodash';
import { EcrService } from './ecr.service';

@JsonController('/api')
export class BuildsController {

  @Inject()
  buildsService: BuildsService;

  @Inject()
  ecrService: EcrService;

  @Inject()
  servicesService: ServicesService;

  @Get('/builds')
  @Authorized()
  @OpenAPI({
    description: 'List of builds', operationId: 'list'
  })
  async list(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request) {
    if (!current.user.sysadmin) {
      await hasDeveloperAccess(request, response, () => {});
    }
    const builds = await this.buildsService.find();
    return response.json(builds);
  }

  @Get('/builds/:buildId')
  @Authorized()
  @OpenAPI({
    description: 'Get build by ID', operationId: 'getById'
  })
  async getById(@CurrentUser() current: Current, @Param('buildId') id: string, @Res() response: Response, @Req() request: Request) {
    if (!current.user.sysadmin) {
      await hasDeveloperAccess(request, response, () => {});
    }
    const result = await this.buildsService.findById(id);
    return response.json(result);
  }


  @Get('/builds/:buildId/cancel')
  @Authorized()
  @OpenAPI({
    description: 'Cancel build by ID', operationId: 'cancel'
  })
  async cancel(@CurrentUser() current: Current, @Param('buildId') id: string, @Res() response: Response, @Req() request: Request) {
    if (!current.user.sysadmin) {
      await hasDeveloperAccess(request, response, () => {});
    }
    const result = await this.buildsService.cancel(id);
    return response.status(201).send();
  }

  @Get('/builds/:buildId/restart')
  @Authorized()
  @OpenAPI({
    description: 'Restart build by ID', operationId: 'restart'
  })
  async restart(@CurrentUser() current: Current, @Param('buildId') id: string, @Res() response: Response, @Req() request: Request) {
    if (!current.user.sysadmin) {
      await hasDeveloperAccess(request, response, () => {});
    }
    const result = await this.buildsService.restart(id);
    return response.status(201).send();
  }

  @Get('/images/:repositoryName')
  @Authorized()
  @OpenAPI({
    description: 'images ', operationId: 'listImages'
  })
  async listImages(@CurrentUser() current: Current, @Param('repositoryName') repositoryName: string, @Res() response: Response, @Req() request: Request) {
    if (!current.user.sysadmin) {
      await hasDeveloperAccess(request, response, () => {});
    }
    const result = await this.ecrService.listImages(repositoryName);
    return response.json(result);
  }

  @Get('/images/:serviceId/deploy/:imageTag')
  @Authorized()
  @OpenAPI({
    description: 'images ', operationId: 'deployByTag'
  })
  async deployByTag(@CurrentUser() current: Current, @Param('serviceId') serviceId: string, @Param('imageTag') imageTag: string, @Res() response: Response, @Req() request: Request) {
    if (!current.user.sysadmin) {
      await hasDeveloperAccess(request, response, () => {});
    }
    const result = await this.buildsService.deployByTag(serviceId, imageTag);
    return response.json(result);
  }

  // @Post('/builds')
  // @Authorized()
  // @OpenAPI({
  //   description: 'Save new build', operationId: 'save'
  // })
  // async saveSettings(@Req() request: Request, @Body() body: any, @Res() response: Response, @CurrentUser() current: Current) {
  //   logger.debug(body);
  //   const build = body;
  //   const result = await this.buildsService.create(build);
  //   return response.json(result);
  // }

  @Post('/builds-webhook')
  @OpenAPI({ description: 'Webhook', operationId: 'webhook' })
  async webhook(@Req() request: Request, @Body() body: any, @Res() response: Response, @CurrentUser() current: Current) {

    const action = request.headers['X-GitHub-Event'.toLowerCase()];
    if (action !== 'push') {
      logger.info('[WEBHOOOK] Not push action:', action, '. Ignoring');
      return response.sendStatus(200);
    }

    const payload = JSON.stringify(body);
    const hmac = crypto.createHmac('sha1', environment.webhook.secret);
    const digest = 'sha1=' + hmac.update(payload).digest('hex');
    const checksum = request.headers['X-Hub-Signature'.toLowerCase()];

    if (!checksum || !digest || checksum !== digest) {
      logger.warn('[WEBHOOOK] wrong secret request');
      return response.sendStatus(401);
    }

    // add it to DB
    let branchesToBuild = [
      `refs/heads/${ environment.webhook.branch.toLowerCase() }`,
    ];
    if (environment.webhook.libBranches) {
      branchesToBuild = branchesToBuild.concat(...environment.webhook.libBranches.split(',').map((name: string) => `refs/heads/${ name.toLowerCase() }`));
    }
    const repoBranch = body.ref.toLowerCase();
    if (branchesToBuild.indexOf(repoBranch) === -1) {
      logger.info(`[WEBHOOOK] Ignoring event for branch: ${ body.ref }; ${ body.repository.name }`);
      return response.sendStatus(200);
    }
    let libsToBuild = [] as any;
    if (environment.webhook.libsToBuild) {
      libsToBuild = libsToBuild.concat(...environment.webhook.libsToBuild.split(',').map((name: string) => name.trim()));
    }
    // add it to DB
    const service = await this.servicesService.findByGitUrl(body.repository.ssh_url);

    let build;
    if (service) {
      build = {
        type: BuildType.AITHEON_SERVICE,
        service: service,
        gitBranch: environment.webhook.branch,
        headCommit: body.head_commit.id,
        notifyEmails: this.getNotifyEmails(body)
      } as Build;
    } else if (libsToBuild.indexOf(body.repository.ssh_url) > -1) {
      build = {
        type: BuildType.AITHEON_LIB,
        name: body.repository.name,
        imageName: body.repository.name,
        gitUrl: body.repository.ssh_url,
        gitBranch: repoBranch.replace('refs/heads/', ''),
        headCommit: body.head_commit.id,
        notifyEmails: this.getNotifyEmails(body)
      } as Build;
    }

    if (!build) {
      logger.info('WebHook: Service/Lib not found.', body.repository.full_name);
      return response.sendStatus(200);
    }

    const result = await this.buildsService.create(build, undefined);
    // this.buildsService.nextBuild(result);
    return response.json(result);
  }

  private getNotifyEmails(body: { commits: Array<{ author: { email: string }}>}): Array<String> {
    const admins: any[] = []; // hardcoded for now
    // 'sergei@aitheon.com'
    const commiters = _.uniq(body.commits.map((c: { author: { email: string }}) => { return c.author.email; }));
    return admins.concat(commiters);
  }
}
