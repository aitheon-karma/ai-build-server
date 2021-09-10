import { Service, Inject } from 'typedi';
import { rimraf, ensureDir, exists } from '../core/fs';
import * as git from 'nodegit';
import * as fs from 'fs';
import { resolve as resolvePath } from 'path';
import { logger } from '@aitheon/core-server';
import { environment } from '../../environment';
import { BuildType } from './build.model';

export type CreateProjectSettings = {
  sessionId: string,
  repoName: string,
  projectName: string,
  forkedProjectName?: string,
};

const AITHEON_PRIVATE_KEY_PATH = resolvePath('./keys/aitheon/id_rsa');
const AITHEON_PUBLIC_KEY_PATH = resolvePath('./keys/aitheon/id_rsa.pub');
const GITHUB_PRIVATE_KEY_PATH = resolvePath('./keys/github/id_rsa');
const GITHUB_PUBLIC_KEY_PATH = resolvePath('./keys/github/id_rsa.pub');

let aitheonKeys: { public: string, private: string };
let githubKeys: { public: string, private: string };

@Service()
export class GitService {

  constructor() {
    if (!aitheonKeys && fs.existsSync(AITHEON_PRIVATE_KEY_PATH)) {
      aitheonKeys = {
        public: fs.readFileSync(AITHEON_PUBLIC_KEY_PATH).toString(),
        private: fs.readFileSync(AITHEON_PRIVATE_KEY_PATH).toString(),
      };
    }
    if (!githubKeys && fs.existsSync(GITHUB_PRIVATE_KEY_PATH)) {
      githubKeys = {
        public: fs.readFileSync(GITHUB_PUBLIC_KEY_PATH).toString(),
        private: fs.readFileSync(GITHUB_PRIVATE_KEY_PATH).toString(),
      };
    }
  }

  getCredentials(buildType: BuildType) {
    if (buildType === BuildType.USER_SERVICE) {
      return git.Cred.sshKeyMemoryNew('git', aitheonKeys.public, aitheonKeys.private, '');
    } else {
      return git.Cred.sshKeyMemoryNew('git', githubKeys.public, githubKeys.private, '');
    }
  }

  /**
   * Clone repository from git-server
   * @param name repository name - `project-${ projectId }.git` or other
   * @param localPath full local path to folder
   */
  async clone(repoUrl: string, localPath: string, buildType: BuildType, headCommit: string) {
    try {
      const repo = await git.Clone.clone(repoUrl, localPath, {
        fetchOpts: {
          callbacks: {
            certificateCheck: () => { return 1; },
            credentials: (url: string, userName: string) => {
              return this.getCredentials(buildType);
            }
          }
        }
      });
      if (headCommit) {
        const commit = await repo.getCommit(git.Oid.fromString(headCommit));
        await git.Checkout.tree(repo, commit);
      }
      console.log(repo);
    } catch (err) {
      logger.error('[GitService] clone:', err);
      throw err;
    }
  }

  // private async pull(repository: git.Repository, branch: string) {
  //   await repository.fetchAll({
  //     callbacks: {
  //       credentials: () => { return this.getCredentials(); },
  //       certificateCheck: () => { return 1; }
  //     }
  //   });
  //   await repository.mergeBranches(branch, `origin/${ branch }`);
  // }

  // private async commit(repository: git.Repository, message: string, username?: string, email?: string) {
  //   const repoIndex = await repository.refreshIndex();
  //   await repoIndex.addAll();
  //   const oid = await repoIndex.writeTree();
  //   const isEmpty = await repository.isEmpty();
  //   let parent;
  //   if (isEmpty === 0) {
  //     parent = await git.Reference.nameToId(repository, 'HEAD');
  //   }
  //   username = username || environment.gitServer.username;
  //   email = email || environment.gitServer.email;
  //   const author = git.Signature.now(username, email);
  //   const committer = git.Signature.now(username, email);

  //   repository.createCommit('HEAD', author, committer, message, oid, parent ? [parent] : []);
  // }

  // private async tag(repoPath: string, tagName: string) {
  //   try {
  //     if (!await exists(repoPath)) {
  //       logger.error('Git Service: folder does not exits!');
  //       return;
  //     }
  //     const branch = 'master';
  //     const repository = await git.Repository.open(repoPath);

  //     const remote = await repository.getRemote('origin');

  //     await remote.push([`refs/heads/${ branch }:refs/tags/${ tagName }`], {
  //       callbacks: {
  //         certificateCheck: () => { return 1; },
  //         credentials: (url: string, userName: string) => {
  //           return this.getCredentials();
  //         }
  //       }
  //     });
  //     console.log('Pushed');
  //   } catch (err) {
  //     logger.error('[GitService] push:', err);
  //     throw err;
  //   }
  // }


  // async push(repoPath: string, message: string, username?: string, email?: string) {
  //   try {
  //     if (!await exists(repoPath)) {
  //       logger.error('Git Service: folder does not exits!');
  //       return;
  //     }
  //     const branch = 'master';
  //     const repository = await git.Repository.open(repoPath);
  //     const isEmpty = await repository.isEmpty();
  //     await this.commit(repository, message, username, email);
  //     if (!isEmpty) {
  //       await this.pull(repository, 'master');
  //     }

  //     const remote = await repository.getRemote('origin');

  //     await remote.push([`refs/heads/${ branch }:refs/heads/${ branch }`], {
  //       callbacks: {
  //         certificateCheck: () => { return 1; },
  //         credentials: (url: string, userName: string) => {
  //           return this.getCredentials();
  //         }
  //       }
  //     });
  //     console.log('Pushed');
  //   } catch (err) {
  //     logger.error('[GitService] push:', err);
  //     throw err;
  //   }
  // }


}

