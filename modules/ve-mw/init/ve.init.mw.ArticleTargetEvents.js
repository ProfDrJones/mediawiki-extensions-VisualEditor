/*!
 * VisualEditor MediaWiki Initialization class.
 *
 * @copyright 2011-2017 VisualEditor Team and others; see AUTHORS.txt
 * @license The MIT License (MIT); see LICENSE.txt
 */

/**
 * Initialization MediaWiki Article Target Analytics.
 *
 * @class
 *
 * @constructor
 * @param {ve.init.mw.ArticleTarget} target Target class to log events for
 */
ve.init.mw.ArticleTargetEvents = function VeInitMwArticleTargetEvents( target ) {
	this.target = target;
	this.timings = { saveRetries: 0 };
	// Events
	this.target.connect( this, {
		saveWorkflowBegin: 'onSaveWorkflowBegin',
		saveWorkflowEnd: 'onSaveWorkflowEnd',
		saveInitiated: 'onSaveInitiated',
		save: 'onSaveComplete',
		saveReview: 'onSaveReview',
		saveErrorEmpty: [ 'trackSaveError', 'empty' ],
		saveErrorSpamBlacklist: [ 'trackSaveError', 'spamblacklist' ],
		saveErrorAbuseFilter: [ 'trackSaveError', 'abusefilter' ],
		saveErrorBadToken: [ 'trackSaveError', 'badtoken' ],
		saveErrorNewUser: [ 'trackSaveError', 'newuser' ],
		saveErrorPageDeleted: [ 'trackSaveError', 'pagedeleted' ],
		saveErrorHookAborted: [ 'trackSaveError', 'responseUnknown' ], // FIXME: Make a specific one.
		saveErrorTitleBlacklist: [ 'trackSaveError', 'titleblacklist' ],
		saveErrorCaptcha: [ 'trackSaveError', 'captcha' ],
		saveErrorReadOnly: [ 'trackSaveError', 'unknown', 'readonly' ],
		saveErrorUnknown: [ 'trackSaveError', 'unknown' ],
		editConflict: [ 'trackSaveError', 'editconflict' ],
		surfaceReady: 'onSurfaceReady',
		showChanges: 'onShowChanges',
		showChangesError: 'onShowChangesError',
		noChanges: 'onNoChanges',
		serializeComplete: 'onSerializeComplete',
		serializeError: 'onSerializeError'
	} );
};

/**
 * Target specific ve.track wrapper
 *
 * @param {string} topic Event name
 * @param {Object} data Additional data describing the event, encoded as an object
 */
ve.init.mw.ArticleTargetEvents.prototype.track = function ( topic, data ) {
	data.targetName = this.target.constructor.static.trackingName;
	data.mode = this.target.surface ? this.target.surface.getMode() : this.target.getDefaultMode();
	ve.track( 'mwtiming.' + topic, data );

	if ( topic.indexOf( 'performance.system.serializeforcache' ) === 0 ) {
		// HACK: track serializeForCache duration here, because there's no event for that
		this.timings.serializeForCache = data.duration;
	}
};

/**
 * Track when user begins the save workflow
 */
ve.init.mw.ArticleTargetEvents.prototype.onSaveWorkflowBegin = function () {
	this.timings.saveWorkflowBegin = ve.now();
	this.track( 'behavior.lastTransactionTillSaveDialogOpen', {
		duration: this.timings.saveWorkflowBegin - this.timings.lastTransaction
	} );
	ve.track( 'mwedit.saveIntent' );
};

/**
 * Track when user ends the save workflow
 */
ve.init.mw.ArticleTargetEvents.prototype.onSaveWorkflowEnd = function () {
	this.track( 'behavior.saveDialogClose', { duration: ve.now() - this.timings.saveWorkflowBegin } );
	this.timings.saveWorkflowBegin = null;
};

/**
 * Track when document save is initiated
 */
ve.init.mw.ArticleTargetEvents.prototype.onSaveInitiated = function () {
	this.timings.saveInitiated = ve.now();
	this.timings.saveRetries++;
	this.track( 'behavior.saveDialogOpenTillSave', {
		duration: this.timings.saveInitiated - this.timings.saveWorkflowBegin
	} );
	ve.track( 'mwedit.saveAttempt' );
};

/**
 * Track when the save is complete
 *
 * @param {string} content
 * @param {string} categoriesHtml
 * @param {number} newRevId
 */
ve.init.mw.ArticleTargetEvents.prototype.onSaveComplete = function ( content, categoriesHtml, newRevId ) {
	this.track( 'performance.user.saveComplete', { duration: ve.now() - this.timings.saveInitiated } );
	this.timings.saveRetries = 0;
	ve.track( 'mwedit.saveSuccess', {
		timing: ve.now() - this.timings.saveInitiated + ( this.timings.serializeForCache || 0 ),
		'page.revid': newRevId
	} );
};

/**
 * Track a save error by type
 *
 * @method
 * @param {string} type Text for error type
 */
ve.init.mw.ArticleTargetEvents.prototype.trackSaveError = function ( type ) {
	var key, data,
		failureArguments = [],
		// Maps mwtiming types to mwedit types
		typeMap = {
			badtoken: 'userBadToken',
			newuser: 'userNewUser',
			abusefilter: 'extensionAbuseFilter',
			captcha: 'extensionCaptcha',
			spamblacklist: 'extensionSpamBlacklist',
			empty: 'responseEmpty',
			unknown: 'responseUnknown',
			pagedeleted: 'editPageDeleted',
			titleblacklist: 'extensionTitleBlacklist',
			editconflict: 'editConflict'
		},
		// Types that are logged as performance.user.saveError.{type}
		// (for historical reasons; this sucks)
		specialTypes = [ 'editconflict' ];

	if ( arguments ) {
		failureArguments = Array.prototype.slice.call( arguments, 1 );
	}

	key = 'performance.user.saveError';
	if ( specialTypes.indexOf( type ) !== -1 ) {
		key += '.' + type;
	}
	this.track( key, {
		duration: ve.now() - this.timings.saveInitiated,
		retries: this.timings.saveRetries,
		type: type
	} );

	data = {
		type: typeMap[ type ] || 'responseUnknown',
		timing: ve.now() - this.timings.saveInitiated + ( this.timings.serializeForCache || 0 )
	};
	if ( type === 'unknown' && failureArguments[ 0 ] ) {
		data.message = failureArguments[ 0 ];
	}
	ve.track( 'mwedit.saveFailure', data );
};

/**
 * Record activation having started.
 *
 * @param {number} [startTime] Timestamp activation started. Defaults to current time
 */
ve.init.mw.ArticleTargetEvents.prototype.trackActivationStart = function ( startTime ) {
	this.timings.activationStart = startTime || ve.now();
};

/**
 * Record activation being complete.
 */
ve.init.mw.ArticleTargetEvents.prototype.trackActivationComplete = function () {
	this.track( 'performance.system.activation', { duration: ve.now() - this.timings.activationStart } );
};

/**
 * Record the time of the last transaction in response to a 'transact' event on the document.
 */
ve.init.mw.ArticleTargetEvents.prototype.recordLastTransactionTime = function () {
	this.timings.lastTransaction = ve.now();
};

/**
 * Track time elapsed from beginning of save workflow to review
 */
ve.init.mw.ArticleTargetEvents.prototype.onSaveReview = function () {
	this.timings.saveReview = ve.now();
	this.track( 'behavior.saveDialogOpenTillReview', {
		duration: this.timings.saveReview - this.timings.saveWorkflowBegin
	} );
};

ve.init.mw.ArticleTargetEvents.prototype.onSurfaceReady = function () {
	this.target.surface.getModel().getDocument().connect( this, {
		transact: 'recordLastTransactionTime'
	} );
};

/**
 * Track when the user enters the review workflow
 */
ve.init.mw.ArticleTargetEvents.prototype.onShowChanges = function () {
	this.track( 'performance.user.reviewComplete', { duration: ve.now() - this.timings.saveReview } );
};

/**
 * Track when the diff request fails in the review workflow
 */
ve.init.mw.ArticleTargetEvents.prototype.onShowChangesError = function () {
	this.track( 'performance.user.reviewError', { duration: ve.now() - this.timings.saveReview } );
};

/**
 * Track when the diff request detects no changes
 */
ve.init.mw.ArticleTargetEvents.prototype.onNoChanges = function () {
	this.track( 'performance.user.reviewComplete', { duration: ve.now() - this.timings.saveReview } );
};

/**
 * Track when serialization is complete in review workflow
 */
ve.init.mw.ArticleTargetEvents.prototype.onSerializeComplete = function () {
	this.track( 'performance.user.reviewComplete', { duration: ve.now() - this.timings.saveReview } );
};

/**
 * Track when there is a serialization error
 */
ve.init.mw.ArticleTargetEvents.prototype.onSerializeError = function () {
	if ( this.timings.saveWorkflowBegin ) {
		// This function can be called by the switch to wikitext button as well, so only log
		// reviewError if we actually got here from the save workflow
		this.track( 'performance.user.reviewError', { duration: ve.now() - this.timings.saveReview } );
	}
};
