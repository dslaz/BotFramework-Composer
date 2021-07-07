// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { PublishConfig, getAccessToken } from '@bfc/extension-client';
import {
  IBotProject,
  IExtensionRegistration,
  ProcessStatus,
  PublishPlugin,
  PublishResponse,
  PublishResult,
  UserIdentity,
} from '@botframework-composer/types';

import { availableResources, setUpProvisionService } from './availableResources';
import { createProcessStatusTracker } from './processStatusTracker';
import {
  GetResourcesResult,
  ProvisionConfig,
  ResourceDefinition,
  ResourceProvisionService,
  GetAccessToken,
} from './types';
import { publish as internalPublish } from './publishing';

const toPublishResponse = (processStatus: ProcessStatus): PublishResponse => {
  const { id, status, message, log, comment, time } = processStatus;

  return {
    status,
    result: {
      comment,
      id,
      log: log.map((item) => `---\n${JSON.stringify(item, null, 2)}\n---\n`).join('\n'),
      message,
      status,
      time: time.toString(),
    },
  };
};

/**
 * Creates the azure publishing plug-in for this extension.
 * @returns The plug-in with properties and methods.
 */
const createAzurePublishPlugin = (registration: IExtensionRegistration): PublishPlugin<PublishConfig> => {
  const processTracker = createProcessStatusTracker();

  const getResources = (project: IBotProject): Promise<GetResourcesResult[]> => {
    const provisionServices: Record<string, ResourceProvisionService> = {};

    return Promise.resolve(
      availableResources.reduce((resources: GetResourcesResult[], currentResource: ResourceDefinition) => {
        const service = provisionServices[currentResource.key];
        if (service.getRecommendationForProject(project) !== 'notAllowed') {
          resources.push({
            ...currentResource,
            required: service.getRecommendationForProject(project) === 'required',
          });
        }
        return resources;
      }, [])
    );
  };

  const getStatus = async (config: PublishConfig, project: IBotProject) => {
    let status = processTracker.get(config.jobId);
    if (!status) {
      status = processTracker.getByProjectId(config.projectId);
    }
    if (!status) {
      status = processTracker.getByProcessName(config.profileName);
    }
    if (!status) {
      status = processTracker.getByProjectId(project.id);
    }

    if (status) {
      return toPublishResponse(status);
    } else {
      return {
        status: 404,
        result: {
          message: 'bot not published',
        },
      };
    }
  };

  const provision = async (config: ProvisionConfig, project: IBotProject): Promise<ProcessStatus> => {
    const { id: processId } = processTracker.start({
      projectId: project.id,
      processName: config.key,
      status: 202,
      message: 'Creating Azure resources...',
    });

    const onProgress = (status: number, message: string) => {
      processTracker.update(processId, { status: status, message: message });
    };

    setUpProvisionService(config, onProgress);
    return processTracker.get(processId);
  };

  const getProvisionStatus = async (
    processName: string,
    project: IBotProject,
    _user,
    jobId = ''
  ): Promise<ProcessStatus> => {
    let status = processTracker.get(jobId);
    if (!status) {
      status = processTracker.getByProjectId(project.id);
    }
    if (!status) {
      status = processTracker.getByProcessName(processName);
    }

    return status;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const publish = async (
    config: PublishConfig,
    project: IBotProject,
    metadata: any,
    user?: UserIdentity,
    getAccessToken?: GetAccessToken
  ): Promise<PublishResponse> => {
    const { id: processId } = processTracker.start({
      projectId: project.id,
      processName: config.key,
      status: 202,
      message: 'Starting publish...',
    });

    try {
      const runtimeTemplate = registration.getRuntimeByProject(project);

      const onProgress = (message: string, status?: number) => {
        processTracker.update(processId, { status, message });
      };

      await internalPublish(config, project, runtimeTemplate, metadata, user, getAccessToken, onProgress);

      processTracker.update(processId, { status: 200, message: 'Publishing completed successfully' });
    } catch (err) {
      processTracker.update(processId, { status: 500, message: `${err}` });
    }

    const publishResponse = toPublishResponse(processTracker.get(processId));
    processTracker.stop(processId);
    return publishResponse;
  };

  return {
    bundleId: 'publish', // we have custom UI to host
    name: 'azurePublishNew',
    description: 'Publish bot to Azure - new',
    getResources,
    getProvisionStatus,
    getStatus,
    provision,
    publish,
  };
};

//----- Register the plug in -----//
const initialize = (registration: IExtensionRegistration) => {
  registration.addPublishMethod(createAzurePublishPlugin(registration));

  // test reading and writing data
  registration.log('Reading from store:\n%O', registration.store.readAll());

  registration.store.replace({ some: 'data' });
  registration.log('Reading from store:\n%O', registration.store.readAll());
};

module.exports = {
  initialize,
};
