import * as http from 'http';
import { environment } from '../environment';
import { logger, ExpressConfig } from '@aitheon/core-server';
import * as docs from '@aitheon/core-server';
import { Container } from 'typedi';
import { BuildsService } from '../modules/builds/builds.service';
import { K8sService } from '../modules/k8s/k8s.service';
import { SimulatorsService } from '../modules/simulators/simulators.service';
import { EcrService } from '../modules/builds/ecr.service';
import { TransporterBroker } from '@aitheon/transporter';
import { GraphsService } from '../modules/graphs/graphs.service';
import { SandboxesService } from '../modules/sandboxes/sandboxes.service';
import { resolve } from 'path';
import { SandboxHotTemplatesService } from '../modules/sandboxes/sandbox-hot-templates.service';

export class Application {

  server: http.Server;
  express: ExpressConfig;

  constructor() {
    /**
     * Inner microservices communication via transporter
     */
    Container.set('environment', environment);
    const transporter = new TransporterBroker(`${ environment.service._id }${ environment.production ? '' : '_DEV'}`);
    transporter.start();


    // const graphsService = Container.get(GraphsService);
    // const graph = require(resolve('./server/config/graph.json')) as Graph;
    // graphsService.publish(graph);

    // const sandboxesService = Container.get(SandboxesService);
    // sandboxesService.create({ user: '5a392c105789b500159c9219' } as Sandbox, {
    //   publicKey : 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCozr31vo0+BlqVCPRfjhBd50hebqWtBNDJ6Ug8kVaH5KGlT1OdoWh8um5P/T5yAgF2ctlGDsbuHH4apHTdsUJjlj4tFLEr+KBFYHclYWxzpY1UA5EqB1r6M4wFEb/xCdEUTEW3wtQDJFbZcaHh/SJCCjqRV7BGFgdGMX48QWs1a2YbxgqNRP3W2CEOyUUheKYHsFtyGxb0Rg1N41EXIBUudk8IAElUE1Njt53d58worTTn/xXFc1/Ss50fKCu4JcDz7emPCK5+TP0qVLBoCWE9fq/oaplrTATfmI2r4+FLbrIJ29sldx/6iEXI5FWxnmo/pOjXla5mRioM1cqcOmRX git@gitea.gitea.svc.cluster.local',
    //   privateKey : '-----BEGIN RSA PRIVATE KEY-----\nMIIEogIBAAKCAQEAqM699b6NPgZalQj0X44QXedIXm6lrQTQyelIPJFWh+ShpU9T\nnaFofLpuT/0+cgIBdnLZRg7G7hx+GqR03bFCY5Y+LRSxK/igRWB3JWFsc6WNVAOR\nKgda+jOMBRG/8QnRFExFt8LUAyRW2XGh4f0iQgo6kVewRhYHRjF+PEFrNWtmG8YK\njUT91tghDslFIXimB7BbchsW9EYNTeNRFyAVLnZPCABJVBNTY7ed3efMKK005/8V\nxXNf0rOdHygruCXA8+3pjwiufkz9KlSwaAlhPX6v6GqZa0wE35iNq+PhS26yCdvb\nJXcf+ohFyORVsZ5qP6To15WuZkYqDNXKnDpkVwIDAQABAoIBAAUW9rNKI4gTOPf1\nZSjcZ7HtH0l5nJUy5/iuh/cLisheJGGPmr3N+BCKrnjK8e8OEG052UM7ftP/F+5F\ntyBYD+Bgz08cqJrizDJLTkxaO6LhAvndgar6vct9cmNUvazO1vb9tbxsq2fM2LGF\ns5PUxguns0xekHoMf/ul0mCOuGTL46Utzw+pQuFiLXYjbHBtd89QXL3tOuYA0ntJ\nHheObpROR2pvYWfT665ZvbxMX52hPtDSUwmXQCzQVuRRNKqiP2zDkPxqXgsj1lgZ\nwy0kDMyyxFpsxcEN80//UsIMxWEnukMkZF7xLoemG7b12IHigRJRSltkeEftGy+5\nL4JQ8oECgYEA1y3Lq/o73n12P1FGwyHZJ8x8YxhpDo5KSv+FvwuIWoTODu8z47Dp\nSQRY8MjwVOUmlnmkfcarziLspT7kvYiLKopCG58b9kWpyIwTOFAZLCqyZJEFsdi4\nUzsl/CO9Ho9n+DiAaHbaZpk5w/FzYdHVgnw0B9KP0scS8ZaH7OwVAOkCgYEAyNTq\nRgcTKFWeJRFYt2TyYJdsct8j7xrgv7N4VuGMkeMRfB4i9c4BKjU1ucXsmCuThECa\nWlaUjgz9a1qM49eluL5FfRjynqIcRsONva1JFut4NOdQJxOm0gmtSdb7TeK/ziy8\n76i17RgnuScLc2QPAANk32Bhn/m1aIyKFCpi8z8CgYAq5lx22xrYjtbmZMPg33y1\n7JTYBOPdHQ0+ypbVsezrbxLN82669GhuQEmjJ8ySgGUjFvlugg96t4fKojFkgDaO\nsqXfb+dZQCZLb3HdhkqefZy3ZBpojLajEWXPUSjBUQH/gPRI33lHf0D/CcJhPD5/\nF1ggPyChe0MRm1taJu9BEQKBgEQPc/2bdDCdI2UohcpRGZsGdihP2tuzXitZZRT8\nhykBrPFFPU/UKqzlL3nvy4iea/XL9wNaiCnD2TZCj7C/alg7k00b4U1FXxPUPfrj\n+PsdfbVgFtfHXyebQ/DcPHpet+XlX3pQ0KazIvMqekT2yeaVP+A7x5nxhDsUNc8z\ntij9AoGAL2m+Yn8v7V8SG/hA8HpYYZhD2NZ+9eB71JrmPDHMvCHZKToHPUrdxjq/\nnSrP3YMhuQkJphq6tNMshtSasxH5D0ghkpAK22+Q2NiQ1dMDht2L452cdv6AwyIk\nJcQKzw952vVqJJaRh9jOL0GXUt2TzGxu2pN3zdyXHgbZjAMiTAY=\n-----END RSA PRIVATE KEY-----'
    // });

    const buildsService = Container.get(BuildsService);
    const k8sService = Container.get(K8sService);
    const simulatorsService = Container.get(SimulatorsService);
    const sandboxHotTemplatesService = Container.get(SandboxHotTemplatesService);

    const sandboxesService = Container.get(SandboxesService);
    const ecrService = Container.get(EcrService);

    // setTimeout(() => {
    //   transporter.broker.emit('graphService.testInput', { myCoolData: true }, 'GRAPH_APP_NODE.1234');
    // }, 5000);

    // setTimeout(async () => {
    //   // const imageName = environment.appsNamespace;
    //   // const ecrImage = await ecrService.getImageByTag('ai-users', 'f47d42b3ab0b1d50d1a6287ba032e53e3e4e9335');
    //   // if (!ecrImage) {
    //   //   throw new Error('No ECR image');
    //   // }
    //   // await ecrService.tagImage(ecrImage, 'prod');
    //   const result = await buildsService.deployByTag('USERS', 'c4f165eb3de70680b189e38c6aa7fcd98f6d835e');
    // }, 1);

    // setTimeout(async () => {
    //   // type: 5e7c8785f1d0e4df034f2a08
    //   const tempaltes = await sandboxHotTemplatesService.findByType('5e987eccee8bfb00132566f1');
    //   tempaltes.forEach(async (template) => {
    //     sandboxesService.terminate({ _id: template._id } as any);
    //     await sandboxHotTemplatesService.remove(template._id);
    //   });
    // }, 2000);
    // sandboxesService.terminate({ _id: '5e7cea584179813f1fcaf710'} as any);
    // sandboxesService.terminate({ _id: '5e7c9d1dffbc5a1b7cff1062'} as any);

    this.express = new ExpressConfig({ bodyLimit: '100mb' });

    docs.init(this.express.app, () => {
      console.log('Swagger documentation generated');
    });

    /**
     * Start server
     */
    this.server = this.express.app.listen(environment.port, () => {
      logger.debug(`
        ------------
        ${ environment.service._id } Service Started!
        Express: http://localhost:${ environment.port }
        ${ environment.production ? 'Production: true' : '' },
        WebHook: ${ environment.webhook.branch.toLowerCase() }
        ------------
      `);
    });


    // const key = 'string' as string;
    // const value = 'd';
    // switch (key) {
    //   case value:
    //     break;
    //   default:
    //     break;
    // }

    // simulatorsService.startSimulator({ _id: '1cbd73fc1861d70011eb6aab', projectType: ProjectType.ROBOT} as Project, '1cbd73fc1861d70011eb6aab');

  }

  // async test() {
  //   const ecrService = Container.get(EcrService);
  //   const version = await ecrService.getLatestVersion('ai-template');
  //   console.log('version', version);
  // }
}