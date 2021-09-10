import { Get, Post, Delete, Put, Body, Param, Res, Req, JsonController, getMetadataArgsStorage, Authorized, CurrentUser, QueryParam, Params, HttpCode } from 'routing-controllers';
import { Inject } from 'typedi';
import { Request, Response } from 'express';
import { Current, logger } from '@aitheon/core-server';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { SandboxSettingsService } from './settings/sandbox-settings.service';
import { SandboxHotTemplatesService } from './sandbox-hot-templates.service';
import { SandboxesService } from './sandboxes.service';

@Authorized()
@JsonController('/api/sandboxes')
export class SandboxesController {

  @Inject()
  sandboxSettingsService: SandboxSettingsService;

  @Inject()
  sandboxesService: SandboxesService;

  @Inject()
  sandboxHotTemplatesService: SandboxHotTemplatesService;

  @Get('/settings')
  @OpenAPI({
    description: 'Get Settings', operationId: 'getSettings'
  })
  async getSettings(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request) {
    if (!current.user.sysadmin) {
      return response.sendStatus(403);
    }
    const settings = await this.sandboxSettingsService.find();
    return response.json(settings);
  }


  @Get('/seed-hot-sandboxes')
  @OpenAPI({
    description: 'seedHotSandboxesV2', operationId: 'seedHotSandboxesV2'
  })
  async seedHotSandboxesV2(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request) {
    if (!current.user.sysadmin) {
      return response.sendStatus(403);
    }
    await this.sandboxesService.seedHotSandboxesV2();
    return response.sendStatus(201);
  }

  @Post('/settings')
  @OpenAPI({
    description: 'Save settings', operationId: 'saveSettings'
  })
  async saveSettings(@Req() request: Request, @Body() body: any, @Res() response: Response, @CurrentUser() current: Current) {
    if (!current.user.sysadmin) {
      return response.sendStatus(403);
    }
    const result = await this.sandboxSettingsService.save(body);
    return response.json(result);
  }

  @Put('/images')
  @OpenAPI({
    description: 'updateHotSandboxImage', operationId: 'updateHotSandboxImage'
  })
  async updateHotSandboxImage(@Req() request: Request, @Body() body: any, @Res() response: Response, @CurrentUser() current: Current) {
    if (!current.user.sysadmin) {
      return response.sendStatus(403);
    }
    const settings = await this.sandboxSettingsService.find();
    const result = await this.sandboxHotTemplatesService.updateHotTemplates(settings);
    return response.json(result);
  }

  @Delete('/hot-templates')
  @OpenAPI({
    description: 'terminateAllTemplates', operationId: 'terminateAllTemplates'
  })
  async terminateAllTemplates(@Req() request: Request, @Res() response: Response, @CurrentUser() current: Current) {
    if (!current.user.sysadmin) {
      return response.sendStatus(403);
    }
    const result = await this.sandboxHotTemplatesService.terminateAllTemplates();
    return response.sendStatus(204);
  }

}
