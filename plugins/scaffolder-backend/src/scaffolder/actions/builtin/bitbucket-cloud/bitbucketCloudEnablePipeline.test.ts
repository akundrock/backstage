jest.mock('../helpers');

import { createBitbucketCloudEnablePipelineAction } from './bitbucketCloudEnablePipeline';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { setupRequestMockHandlers } from '@backstage/backend-test-utils';
import { ScmIntegrations } from '@backstage/integration';
import { ConfigReader } from '@backstage/config';
import { getVoidLogger } from '@backstage/backend-common';
import { PassThrough } from 'stream';
import { initRepoAndPush } from '../helpers';

describe('bitbucketCloud:pipeline:enable', () => {
    const config = new ConfigReader({
      integrations: {
        bitbucketCloud: [
          {
            username: 'u',
            appPassword: 'p',
          },
        ],
      },
    });
  
    const integrations = ScmIntegrations.fromConfig(config);
    const action = createBitbucketCloudEnablePipelineAction({ integrations, config });
    const mockContext = {
      input: {
        repoUrl: 'bitbucket.org?workspace=workspace&project=project&repo=repo',
        repoVisibility: 'private' as const,
      },
      workspacePath: 'wsp',
      logger: getVoidLogger(),
      logStream: new PassThrough(),
      output: jest.fn(),
      createTemporaryDirectory: jest.fn(),
    };
    const server = setupServer();
    setupRequestMockHandlers(server);
  
    beforeEach(() => {
      jest.resetAllMocks();
    });
  
    it('should throw an error when the repoUrl is not well formed', async () => {
      await expect(
        action.handler({
          ...mockContext,
          input: {
            ...mockContext.input,
            repoUrl: 'bitbucket.org?project=project&repo=repo',
          },
        }),
      ).rejects.toThrow(/missing workspace/);
  
      await expect(
        action.handler({
          ...mockContext,
          input: {
            ...mockContext.input,
            repoUrl: 'bitbucket.org?workspace=workspace&repo=repo',
          },
        }),
      ).rejects.toThrow(/missing project/);
  
      await expect(
        action.handler({
          ...mockContext,
          input: {
            ...mockContext.input,
            repoUrl: 'bitbucket.org?workspace=workspace&project=project',
          },
        }),
      ).rejects.toThrow(/missing repo/);
    });
  
    it('should throw if there is no integration config provided', async () => {
      await expect(
        action.handler({
          ...mockContext,
          input: {
            ...mockContext.input,
            repoUrl: 'missing.com?workspace=workspace&project=project&repo=repo',
          },
        }),
      ).rejects.toThrow(/No matching integration configuration/);
    });
  
    it('should throw if there is no token in the integration config that is returned', async () => {
      const configNoCreds = new ConfigReader({
        integrations: {
          bitbucketCloud: [],
        },
      });
  
      const integrationsNoCreds = ScmIntegrations.fromConfig(configNoCreds);
      const actionNoCreds = createBitbucketCloudEnablePipelineAction({
        integrations: integrationsNoCreds,
        config: configNoCreds,
      });
  
      await expect(actionNoCreds.handler(mockContext)).rejects.toThrow(
        /Authorization has not been provided for Bitbucket Cloud/,
      );
    });
  
    it('should call the correct APIs', async () => {
      expect.assertions(2);
      server.use(
        rest.put(
          'https://api.bitbucket.org/2.0/repositories/workspace/repo/pipelines_config',
          (req, res, ctx) => {
            expect(req.headers.get('Authorization')).toBe('Basic dTpw');
            expect(req.body).toEqual({
              enabled: true,
              repository: {},
            });
            return res(
              ctx.status(200),
              ctx.set('Content-Type', 'application/json'),
              ctx.json({
                links: {
                  html: {
                    href: 'https://bitbucket.org/workspace/repo',
                  },
                  clone: [
                    {
                      name: 'https',
                      href: 'https://bitbucket.org/workspace/repo',
                    },
                  ],
                },
              }),
            );
          },
        ),
      );
  
      await action.handler(mockContext);
    });
  
    // it('should work if the token is provided through ctx.input', async () => {
    //   expect.assertions(2);
    //   const token = 'user-token';
    //   server.use(
    //     rest.post(
    //       'https://api.bitbucket.org/2.0/repositories/workspace/repo',
    //       (req, res, ctx) => {
    //         expect(req.headers.get('Authorization')).toBe(`Bearer ${token}`);
    //         expect(req.body).toEqual({
    //           is_private: true,
    //           scm: 'git',
    //           project: { key: 'project' },
    //         });
    //         return res(
    //           ctx.status(200),
    //           ctx.set('Content-Type', 'application/json'),
    //           ctx.json({
    //             links: {
    //               html: {
    //                 href: 'https://bitbucket.org/workspace/repo',
    //               },
    //               clone: [
    //                 {
    //                   name: 'https',
    //                   href: 'https://bitbucket.org/workspace/repo',
    //                 },
    //               ],
    //             },
    //           }),
    //         );
    //       },
    //     ),
    //   );
    //   await action.handler({
    //     ...mockContext,
    //     input: {
    //       ...mockContext.input,
    //       token: token,
    //     },
    //   });
    // });
  
    // it('should call initAndPush with the correct values', async () => {
    //   server.use(
    //     rest.post(
    //       'https://api.bitbucket.org/2.0/repositories/workspace/repo',
    //       (_, res, ctx) =>
    //         res(
    //           ctx.status(200),
    //           ctx.set('Content-Type', 'application/json'),
    //           ctx.json({
    //             links: {
    //               html: {
    //                 href: 'https://bitbucket.org/workspace/repo',
    //               },
    //               clone: [
    //                 {
    //                   name: 'https',
    //                   href: 'https://bitbucket.org/workspace/cloneurl',
    //                 },
    //               ],
    //             },
    //           }),
    //         ),
    //     ),
    //   );
  
    //   await action.handler(mockContext);
  
    //   expect(initRepoAndPush).toHaveBeenCalledWith({
    //     dir: mockContext.workspacePath,
    //     remoteUrl: 'https://bitbucket.org/workspace/cloneurl',
    //     defaultBranch: 'master',
    //     auth: { username: 'u', password: 'p' },
    //     logger: mockContext.logger,
    //     gitAuthorInfo: {},
    //   });
    // });
  
    // it('should call initAndPush with the correct default branch', async () => {
    //   server.use(
    //     rest.post(
    //       'https://api.bitbucket.org/2.0/repositories/workspace/repo',
    //       (_, res, ctx) =>
    //         res(
    //           ctx.status(200),
    //           ctx.set('Content-Type', 'application/json'),
    //           ctx.json({
    //             links: {
    //               html: {
    //                 href: 'https://bitbucket.org/workspace/repo',
    //               },
    //               clone: [
    //                 {
    //                   name: 'https',
    //                   href: 'https://bitbucket.org/workspace/cloneurl',
    //                 },
    //               ],
    //             },
    //           }),
    //         ),
    //     ),
    //   );
  
    //   await action.handler({
    //     ...mockContext,
    //     input: {
    //       ...mockContext.input,
    //       defaultBranch: 'main',
    //     },
    //   });
  
    //   expect(initRepoAndPush).toHaveBeenCalledWith({
    //     dir: mockContext.workspacePath,
    //     remoteUrl: 'https://bitbucket.org/workspace/cloneurl',
    //     defaultBranch: 'main',
    //     auth: { username: 'u', password: 'p' },
    //     logger: mockContext.logger,
    //     gitAuthorInfo: {},
    //   });
    // });
  
    // it('should call initAndPush with the configured defaultAuthor', async () => {
    //   const customAuthorConfig = new ConfigReader({
    //     integrations: {
    //       bitbucketCloud: [
    //         {
    //           username: 'u',
    //           appPassword: 'p',
    //         },
    //       ],
    //     },
    //     scaffolder: {
    //       defaultAuthor: {
    //         name: 'Test',
    //         email: 'example@example.com',
    //       },
    //     },
    //   });
  
    //   const customAuthorIntegrations =
    //     ScmIntegrations.fromConfig(customAuthorConfig);
    //   const customAuthorAction = createBitbucketCloudEnablePipelineAction({
    //     integrations: customAuthorIntegrations,
    //     config: customAuthorConfig,
    //   });
  
    //   server.use(
    //     rest.post(
    //       'https://api.bitbucket.org/2.0/repositories/workspace/repo',
    //       (_, res, ctx) =>
    //         res(
    //           ctx.status(200),
    //           ctx.set('Content-Type', 'application/json'),
    //           ctx.json({
    //             links: {
    //               html: {
    //                 href: 'https://bitbucket.org/workspace/repo',
    //               },
    //               clone: [
    //                 {
    //                   name: 'https',
    //                   href: 'https://bitbucket.org/workspace/cloneurl',
    //                 },
    //               ],
    //             },
    //           }),
    //         ),
    //     ),
    //   );
  
    //   await customAuthorAction.handler(mockContext);
  
    //   expect(initRepoAndPush).toHaveBeenCalledWith({
    //     dir: mockContext.workspacePath,
    //     remoteUrl: 'https://bitbucket.org/workspace/cloneurl',
    //     auth: { username: 'u', password: 'p' },
    //     logger: mockContext.logger,
    //     defaultBranch: 'master',
    //     gitAuthorInfo: { name: 'Test', email: 'example@example.com' },
    //   });
    // });
  
    // it('should call initAndPush with the configured defaultCommitMessage', async () => {
    //   const customAuthorConfig = new ConfigReader({
    //     integrations: {
    //       bitbucketCloud: [
    //         {
    //           username: 'u',
    //           appPassword: 'p',
    //         },
    //       ],
    //     },
    //     scaffolder: {
    //       defaultCommitMessage: 'Test commit message',
    //     },
    //   });
  
    //   const customAuthorIntegrations =
    //     ScmIntegrations.fromConfig(customAuthorConfig);
    //   const customAuthorAction = createBitbucketCloudEnablePipelineAction({
    //     integrations: customAuthorIntegrations,
    //     config: customAuthorConfig,
    //   });
  
    //   server.use(
    //     rest.post(
    //       'https://api.bitbucket.org/2.0/repositories/workspace/repo',
    //       (_, res, ctx) =>
    //         res(
    //           ctx.status(200),
    //           ctx.set('Content-Type', 'application/json'),
    //           ctx.json({
    //             links: {
    //               html: {
    //                 href: 'https://bitbucket.org/workspace/repo',
    //               },
    //               clone: [
    //                 {
    //                   name: 'https',
    //                   href: 'https://bitbucket.org/workspace/cloneurl',
    //                 },
    //               ],
    //             },
    //           }),
    //         ),
    //     ),
    //   );
  
    //   await customAuthorAction.handler(mockContext);
  
    //   expect(initRepoAndPush).toHaveBeenCalledWith({
    //     dir: mockContext.workspacePath,
    //     remoteUrl: 'https://bitbucket.org/workspace/cloneurl',
    //     auth: { username: 'u', password: 'p' },
    //     logger: mockContext.logger,
    //     defaultBranch: 'master',
    //     commitMessage: 'Test commit message',
    //     gitAuthorInfo: { email: undefined, name: undefined },
    //   });
    // });
  
    // it('should call outputs with the correct urls', async () => {
    //   server.use(
    //     rest.post(
    //       'https://api.bitbucket.org/2.0/repositories/workspace/repo',
    //       (_, res, ctx) =>
    //         res(
    //           ctx.status(200),
    //           ctx.set('Content-Type', 'application/json'),
    //           ctx.json({
    //             links: {
    //               html: {
    //                 href: 'https://bitbucket.org/workspace/repo',
    //               },
    //               clone: [
    //                 {
    //                   name: 'https',
    //                   href: 'https://bitbucket.org/workspace/cloneurl',
    //                 },
    //               ],
    //             },
    //           }),
    //         ),
    //     ),
    //   );
  
    //   await action.handler(mockContext);
  
    //   expect(mockContext.output).toHaveBeenCalledWith(
    //     'remoteUrl',
    //     'https://bitbucket.org/workspace/cloneurl',
    //   );
    //   expect(mockContext.output).toHaveBeenCalledWith(
    //     'repoContentsUrl',
    //     'https://bitbucket.org/workspace/repo/src/master',
    //   );
    // });
  
    // it('should call outputs with the correct urls with correct default branch', async () => {
    //   server.use(
    //     rest.post(
    //       'https://api.bitbucket.org/2.0/repositories/workspace/repo',
    //       (_, res, ctx) =>
    //         res(
    //           ctx.status(200),
    //           ctx.set('Content-Type', 'application/json'),
    //           ctx.json({
    //             links: {
    //               html: {
    //                 href: 'https://bitbucket.org/workspace/repo',
    //               },
    //               clone: [
    //                 {
    //                   name: 'https',
    //                   href: 'https://bitbucket.org/workspace/cloneurl',
    //                 },
    //               ],
    //             },
    //           }),
    //         ),
    //     ),
    //   );
  
    //   await action.handler({
    //     ...mockContext,
    //     input: {
    //       ...mockContext.input,
    //       defaultBranch: 'main',
    //     },
    //   });
  
    //   expect(mockContext.output).toHaveBeenCalledWith(
    //     'remoteUrl',
    //     'https://bitbucket.org/workspace/cloneurl',
    //   );
    //   expect(mockContext.output).toHaveBeenCalledWith(
    //     'repoContentsUrl',
    //     'https://bitbucket.org/workspace/repo/src/main',
    //   );
    // });
  });
  