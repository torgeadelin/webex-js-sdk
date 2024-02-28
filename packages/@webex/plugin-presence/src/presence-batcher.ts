/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Batcher} from '@webex/webex-core';
import {IPresenceBatcher} from './interface';

/**
 * @class
 * @ignore
 */
const PresenceBatcher: IPresenceBatcher = Batcher.extend({
  namespace: 'Presence',

  /**
   * @instance
   * @memberof PresenceBatcher
   * @param {HttpResponseObject} res
   * @returns {Promise}
   */
  handleHttpSuccess(res: any): Promise<any> {
    return Promise.all(
      res.body.statusList.map((presenceResponse) =>
        this.handleItemSuccess(presenceResponse.subject, presenceResponse)
      )
    );
  },

  /**
   * @instance
   * @memberof PresenceBatcher
   * @param {string} item
   * @param {Object} response
   * @returns {Promise}
   */
  handleItemFailure(item: string, response: any): Promise<any> {
    return this.getDeferredForResponse(item).then((defer) => {
      defer.reject(response);
    });
  },

  /**
   * @instance
   * @memberof PresenceBatcher
   * @param {string} item
   * @param {Object} response
   * @returns {Promise}
   */
  handleItemSuccess(item: string, response: any): Promise<any> {
    return this.getDeferredForResponse(item).then((defer) => {
      defer.resolve(response);
    });
  },

  /**
   * @instance
   * @memberof PresenceBatcher
   * @param {string} id
   * @returns {Promise<string>}
   */
  fingerprintRequest(id: string): Promise<string> {
    return Promise.resolve(id);
  },

  /**
   * @instance
   * @memberof PresenceBatcher
   * @param {string} id
   * @returns {Promise<string>}
   */
  fingerprintResponse(id: string): Promise<string> {
    return Promise.resolve(id);
  },

  /**
   * @instance
   * @memberof PresenceBatcher
   * @param {Array} ids
   * @returns {Promise<Array>}
   */
  prepareRequest(ids: string[]): Promise<string[]> {
    return Promise.resolve(ids);
  },

  /**
   * @instance
   * @memberof PresenceBatcher
   * @param {Object} subjects
   * @returns {Promise<HttpResponseObject>}
   */
  submitHttpRequest(subjects: any): Promise<any> {
    return this.webex.request({
      method: 'POST',
      api: 'apheleia',
      resource: 'compositions',
      body: {subjects},
    });
  },
});

export default PresenceBatcher;
