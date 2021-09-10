import { Service, Inject } from 'typedi';
import * as nodemailer from 'nodemailer';
import * as inlineCss from 'nodemailer-juice';
import { environment } from '../../environment';
import { logger } from '@aitheon/core-server';
import * as fs from 'fs';
import * as util from 'util';
import * as handlebars from 'handlebars';
const readFile = util.promisify(fs.readFile);

@Service()
export class MailerService {

  private _smtpTransport: any;

  constructor() {
    console.log('MailerService constructor:');
    this.init();
  }

  private init() {
    console.log('Mailer init...');
    const smtpTransport = nodemailer.createTransport(environment.mailer as any);
    smtpTransport.use('compile', inlineCss());

    this._smtpTransport = smtpTransport;
  }

  async send(mailOptions: nodemailer.SendMailOptions): Promise<void> {
    return new Promise<void>((resolve, reject) => {
     try {
      this._smtpTransport.sendMail(mailOptions, (err: any) => {
        if (err) {
          logger.error('[MAILER]', err);
          return reject();
        }
        resolve();
      });
     } catch (err) {
      logger.error('[MAILER] catch', err);
      reject();
     }
    });
  }

  async renderHtml(path: string, options: any): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
      try {
        const htmlContent = await readFile(path, 'utf8');
        const template = handlebars.compile(htmlContent);
        const emailHTML = template(options);
        resolve(emailHTML);
      } catch (err) {
        logger.error('[MAILER] renderHtml catch', err);
        reject(err);
      }
    });

  }
}

export class SendMailOptions {
  to: string;
  from: string;
  subject: string;
  html: string;

  constructor(to: string, subject: string, html: string, from?: string) {
    this.to = to;
    this.subject = subject;
    this.html = html;
    this.from = from || environment.mailer.from;
  }
}

