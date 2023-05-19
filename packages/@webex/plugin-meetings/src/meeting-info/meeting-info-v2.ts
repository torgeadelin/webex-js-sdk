import lodash from 'lodash';
import {
  HTTP_VERBS,
  _CONVERSATION_URL_,
  WBXAPPAPI_SERVICE,
  DEFAULT_MEETING_INFO_REQUEST_BODY,
} from '../constants';
import Metrics from '../metrics';
import {eventType} from '../metrics/config';
import BEHAVIORAL_METRICS from '../metrics/constants';

import MeetingInfoUtil from './utilv2';

const PASSWORD_ERROR_DEFAULT_MESSAGE =
  'Password required. Call fetchMeetingInfo() with password argument';
const CAPTCHA_ERROR_DEFAULT_MESSAGE =
  'Captcha required. Call fetchMeetingInfo() with captchaInfo argument';
const ADHOC_MEETING_DEFAULT_ERROR =
  'Failed starting the adhoc meeting, Please contact support team ';
const CAPTCHA_ERROR_REQUIRES_PASSWORD_CODES = [423005, 423006];
const POLICY_ERROR_CODES = [403049, 403104, 403103, 403048, 403102, 403101];

/**
 * Error to indicate that wbxappapi requires a password
 */
export class MeetingInfoV2PasswordError extends Error {
  meetingInfo: any;
  sdkMessage: any;
  wbxAppApiCode: any;
  body: any;

  /**
   *
   * @constructor
   * @param {Number} [wbxAppApiErrorCode]
   * @param {Object} [meetingInfo]
   * @param {String} [message]
   */
  constructor(
    wbxAppApiErrorCode?: number,
    meetingInfo?: object,
    message: string = PASSWORD_ERROR_DEFAULT_MESSAGE
  ) {
    super(`${message}, code=${wbxAppApiErrorCode}`);
    this.name = 'MeetingInfoV2PasswordError';
    this.sdkMessage = message;
    this.stack = new Error().stack;
    this.wbxAppApiCode = wbxAppApiErrorCode;
    this.meetingInfo = meetingInfo;
  }
}

/**
 * Error generating a adhoc space meeting
 */
export class MeetingInfoV2AdhocMeetingError extends Error {
  sdkMessage: any;
  wbxAppApiCode: any;
  /**
   *
   * @constructor
   * @param {Number} [wbxAppApiErrorCode]
   * @param {String} [message]
   */
  constructor(wbxAppApiErrorCode?: number, message: string = ADHOC_MEETING_DEFAULT_ERROR) {
    super(`${message}, code=${wbxAppApiErrorCode}`);
    this.name = 'MeetingInfoV2AdhocMeetingError';
    this.sdkMessage = message;
    this.stack = new Error().stack;
    this.wbxAppApiCode = wbxAppApiErrorCode;
  }
}

/**
 * Error preventing join because of a meeting policy
 */
export class MeetingInfoV2PolicyError extends Error {
  meetingInfo: object;
  sdkMessage: string;
  wbxAppApiCode: number;
  /**
   *
   * @constructor
   * @param {Number} [wbxAppApiErrorCode]
   * @param {Object} [meetingInfo]
   * @param {String} [message]
   */
  constructor(wbxAppApiErrorCode?: number, meetingInfo?: object, message?: string) {
    super(`${message}, code=${wbxAppApiErrorCode}`);
    this.name = 'MeetingInfoV2AdhocMeetingError';
    this.sdkMessage = message;
    this.stack = new Error().stack;
    this.wbxAppApiCode = wbxAppApiErrorCode;
    this.meetingInfo = meetingInfo;
  }
}

/**
 * Error to indicate that preferred webex site not present to start adhoc meeting
 */
export class MeetingInfoV2CaptchaError extends Error {
  captchaInfo: any;
  isPasswordRequired: any;
  sdkMessage: any;
  wbxAppApiCode: any;
  body: any;
  /**
   *
   * @constructor
   * @param {Number} [wbxAppApiErrorCode]
   * @param {Object} [captchaInfo]
   * @param {String} [message]
   */
  constructor(
    wbxAppApiErrorCode?: number,
    captchaInfo?: object,
    message: string = CAPTCHA_ERROR_DEFAULT_MESSAGE
  ) {
    super(`${message}, code=${wbxAppApiErrorCode}`);
    this.name = 'MeetingInfoV2PasswordError';
    this.sdkMessage = message;
    this.stack = new Error().stack;
    this.wbxAppApiCode = wbxAppApiErrorCode;
    this.isPasswordRequired = CAPTCHA_ERROR_REQUIRES_PASSWORD_CODES.includes(wbxAppApiErrorCode);
    this.captchaInfo = captchaInfo;
  }
}

/**
 * @class MeetingInfo
 */
export default class MeetingInfoV2 {
  webex: any;

  /**
   *
   * @param {WebexSDK} webex
   */
  constructor(webex) {
    this.webex = webex;
  }

  /**
   * converts hydra id into conversation url and persons Id
   * @param {String} destination one of many different types of destinations to look up info for
   * @param {String} [type] to match up with the destination value
   * @returns {Promise} destination and type
   * @public
   * @memberof MeetingInfo
   */
  fetchInfoOptions(destination: string, type: string = null) {
    return MeetingInfoUtil.getDestinationType({
      destination,
      type,
      webex: this.webex,
    });
  }

  /**
   * Creates adhoc space meetings for a space by fetching the conversation infomation
   * @param {String} conversationUrl conversationUrl to start adhoc meeting on
   * @returns {Promise} returns a meeting info object
   * @public
   * @memberof MeetingInfo
   */
  async createAdhocSpaceMeeting(conversationUrl: string) {
    if (!this.webex.meetings.preferredWebexSite) {
      throw Error('No preferred webex site found');
    }
    const getInvitees = (particpants = []) => {
      const invitees = [];

      if (particpants) {
        particpants.forEach((participant) => {
          invitees.push({
            email: participant.emailAddress,
            ciUserUuid: participant.entryUUID,
          });
        });
      }

      return invitees;
    };

    return this.webex.internal.conversation
      .get({url: conversationUrl}, {includeParticipants: true, disableTransform: true})
      .then((conversation) => {
        const body = {
          title: conversation.displayName,
          spaceUrl: conversation.url,
          keyUrl: conversation.encryptionKeyUrl,
          kroUrl: conversation.kmsResourceObjectUrl,
          invitees: getInvitees(conversation.participants?.items),
        };

        const uri = this.webex.meetings.preferredWebexSite
          ? `https://${this.webex.meetings.preferredWebexSite}/wbxappapi/v2/meetings/spaceInstant`
          : '';

        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.ADHOC_MEETING_SUCCESS);

        return this.webex.request({
          method: HTTP_VERBS.POST,
          uri,
          body,
        });
      })
      .catch((err) => {
        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.ADHOC_MEETING_FAILURE, {
          reason: err.message,
          stack: err.stack,
        });
        throw new MeetingInfoV2AdhocMeetingError(err.body?.code, err.body?.message);
      });
  }

  /**
   * Fetches meeting info from the server
   * @param {String} destination one of many different types of destinations to look up info for
   * @param {String} [type] to match up with the destination value
   * @param {String} password
   * @param {Object} captchaInfo
   * @param {String} captchaInfo.code
   * @param {String} captchaInfo.id
   * @param {String} installedOrgID
   * @param {String} locusId
   * @param {Object} extraParams
   * @returns {Promise} returns a meeting info object
   * @public
   * @memberof MeetingInfo
   */
  async fetchMeetingInfo(
    destination: string,
    type: string = null,
    password: string = null,
    captchaInfo: {
      code: string;
      id: string;
    } = null,
    installedOrgID = null,
    locusId = null,
    extraParams: {meetingId?: string; [key: string]: string} = {}
  ) {
    let meetingId: string;
    if (extraParams.meetingId) {
      meetingId = extraParams.meetingId;
      delete extraParams.meetingId;
    }

    const destinationType = await MeetingInfoUtil.getDestinationType({
      destination,
      type,
      webex: this.webex,
    });

    if (
      destinationType.type === _CONVERSATION_URL_ &&
      this.webex.config.meetings.experimental.enableAdhocMeetings &&
      this.webex.meetings.preferredWebexSite
    ) {
      return this.createAdhocSpaceMeeting(destinationType.destination);
    }

    const body = await MeetingInfoUtil.getRequestBody({
      ...destinationType,
      password,
      captchaInfo,
      installedOrgID,
      locusId,
      extraParams,
    });

    // If the body only contains the default properties, we don't have enough to
    // fetch the meeting info so don't bother trying.
    if (
      !lodash.difference(Object.keys(body), Object.keys(DEFAULT_MEETING_INFO_REQUEST_BODY)).length
    ) {
      const err = new Error('Not enough information to fetch meeting info');
      Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.FETCH_MEETING_INFO_V1_FAILURE, {
        reason: err.message,
        destinationType: destinationType?.type,
        webExMeetingId: destinationType?.info?.webExMeetingId,
        sipUri: destinationType?.info?.sipUri,
      });

      throw err;
    }

    const options: any = {
      method: HTTP_VERBS.POST,
      body,
    };

    const directURI = await MeetingInfoUtil.getDirectMeetingInfoURI(destinationType);

    if (directURI) {
      options.uri = directURI;
    } else {
      options.service = WBXAPPAPI_SERVICE;
      options.resource = 'meetingInfo';
    }

    return this.webex
      .request(options)
      .then((response) => {
        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.FETCH_MEETING_INFO_V1_SUCCESS);

        return response;
      })
      .catch((err) => {
        if (meetingId) {
          Metrics.postEvent({
            event: eventType.MEETING_INFO_RESPONSE,
            meetingId,
            data: {
              errors: [Metrics.parseWebexApiError(err, true)],
              meetingLookupUrl: err?.url,
            },
          });
        }

        if (err?.statusCode === 403) {
          if (POLICY_ERROR_CODES.includes(err.body?.code)) {
            Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MEETING_INFO_POLICY_ERROR, {
              code: err.body?.code,
            });

            throw new MeetingInfoV2PolicyError(
              err.body?.code,
              err.body?.data?.meetingInfo,
              err.body?.message
            );
          }

          Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.VERIFY_PASSWORD_ERROR, {
            reason: err.message,
            stack: err.stack,
          });

          throw new MeetingInfoV2PasswordError(err.body?.code, err.body?.data?.meetingInfo);
        }
        if (err?.statusCode === 423) {
          Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.VERIFY_CAPTCHA_ERROR, {
            reason: err.message,
            stack: err.stack,
          });

          throw new MeetingInfoV2CaptchaError(err.body?.code, {
            captchaId: err.body.captchaID,
            verificationImageURL: err.body.verificationImageURL,
            verificationAudioURL: err.body.verificationAudioURL,
            refreshURL: err.body.refreshURL,
          });
        }

        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.FETCH_MEETING_INFO_V1_FAILURE, {
          reason: err.message,
          stack: err.stack,
        });
        throw err;
      });
  }
}
