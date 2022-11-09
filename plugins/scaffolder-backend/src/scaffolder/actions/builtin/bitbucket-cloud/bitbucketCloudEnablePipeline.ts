/*
 * Copyright 2021 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ScmIntegrationRegistry } from '@backstage/integration';
import { createTemplateAction } from '../../createTemplateAction';
import { Config } from '@backstage/config';
import { getBitbucketCloudConfig } from './util';
import { enablePipeline } from './helpers';

/**
 * Creates a new action that enabled pipelines on a repo in Bitbucket Cloud.
 * @public
 */
export function createBitbucketCloudEnablePipelineAction(options: {
  integrations: ScmIntegrationRegistry;
  config: Config;
}) {
  const { integrations, config } = options;

  return createTemplateAction<{
    repoUrl: string;
    token?: string;
  }>({
    id: 'bitbucketCloud:pipeline:enable',
    description:
      'Enables pipelines on a repo in Bitbucket Cloud.',
    schema: {
      input: {
        type: 'object',
        required: ['repoUrl'],
        properties: {
          repoUrl: {
            title: 'Repository Location',
            type: 'string',
          },
          token: {
            title: 'Authentication Token',
            type: 'string',
            description:
              'The token to use for authorization to BitBucket Cloud',
          },
        },
      },
      output: {
        type: 'object',
        properties: {
          pipelineEnabled: {
            title: 'Was the pipeline enabled?',
            type: 'boolean',
          },
        },
      },
    },
    async handler(ctx) {

      const {
        apiBaseUrl,
        authorization,
        repo,
        workspace,
      } = getBitbucketCloudConfig(ctx, integrations)

      ctx.logger.info(`Enabling pipeline for repository: ${apiBaseUrl}/${workspace}/${repo}`)
      // Use Bitbucket API to enable pipelines for a repo
      const { pipelineEnabled } = await enablePipeline({
        authorization,
        workspace: workspace,
        repo,
        apiBaseUrl,
      });

      ctx.logger.info(`Status: ${pipelineEnabled}`)
      ctx.output('pipelineEnabled', pipelineEnabled);
    },
  });
}
