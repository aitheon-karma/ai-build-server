import { Get, Post, Delete, Put, Body, Param, Res, Req, JsonController, getMetadataArgsStorage, Authorized, CurrentUser, QueryParam, Params, HttpCode } from 'routing-controllers';
import { Inject } from 'typedi';
import { SettingsService } from './settings.service';
import { Settings, SettingsSchema } from './settings.model';
import { Request, Response } from 'express';
import { Current, logger } from '@aitheon/core-server';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { settings } from 'cluster';

@Authorized()
@JsonController('/api/settings')
export class SettingsController {

  @Inject()
  settingsService: SettingsService;

  @Get('/')
  @OpenAPI({
    description: 'List of Settings', operationId: 'list'
  })
  async list(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request) {
    if (!current.user.sysadmin) {
      return response.sendStatus(403);
    }
    const settings = await this.settingsService.find();
    return response.json(settings);
  }

  @Get('/:settingsId')
  @OpenAPI({
    description: 'Get settings by ID', operationId: 'getById'
  })
  async getById( @CurrentUser() current: Current, @Param('settingsId') id: string, @Res() response: Response) {
    if (!current.user.sysadmin) {
      return response.sendStatus(403);
    }
    const result = await this.settingsService.findById(id);
    return response.json(result);
  }

  @Post('/')
  @OpenAPI({
    description: 'Save new settings', operationId: 'save'
  })
  async saveSettings(@Req() request: Request, @Body() body: any, @Res() response: Response, @CurrentUser() current: Current) {
    if (!current.user.sysadmin) {
      return response.sendStatus(403);
    }
    const settings = body;
    const result = await this.settingsService.create(settings);
    return response.json(result);
  }

  @Put('/:settingsId')
  @OpenAPI({
    description: 'Update settings by ID', operationId: 'update'
  })
  async updateSettings(@Req() request: Request, @Body() body: Settings, @Res() response: Response, @CurrentUser() current: Current, @Param('settingsId') settingsId: string) {
    if (!current.user.sysadmin) {
      return response.sendStatus(403);
    }
    const settings = body;
    const result = await this.settingsService.update(settings);
    return response.sendStatus(204);
  }

}
