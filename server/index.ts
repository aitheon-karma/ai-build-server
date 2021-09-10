'use strict';
import 'ts-helpers';
import 'reflect-metadata';
import { environment } from './environment';
import { Container } from 'typedi';
import { Application } from './config/application';

export default new Application();
