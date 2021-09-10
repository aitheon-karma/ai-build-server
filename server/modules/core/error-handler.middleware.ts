import { Middleware, ExpressErrorMiddlewareInterface } from 'routing-controllers';
import { logger } from '@aitheon/core-server';
import { Response, Request } from 'express';
import { environment } from '../../environment';

@Middleware({ type: 'after' })
export class ErrorHandler implements ExpressErrorMiddlewareInterface {

  error(error: any, request: Request, response: Response, next: (err: any) => any) {

    switch (error.name) {
      case 'AccessDeniedError':
      case 'AuthorizationRequiredError':
        logger.info('[AUTH] AccessDeniedError: ', error.message);
        return response.status(401).send();
      case 'BadRequestError':
        let message = '';
        error.errors.forEach((err: any) => {
          message += err.toString();
        });
        return response.status(422).send({ message: message });
      default:
        logger.error(`[ErrorHandler]: Request[${ request.url }];`, error);
        return response.status(500).send({ message: error.message });
    }

  }

}