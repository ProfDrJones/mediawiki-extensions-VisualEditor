/*!
 * VisualEditor UserInterface MWMediaSearchWidget class.
 *
 * @copyright 2011-2014 VisualEditor Team and others; see AUTHORS.txt
 * @license The MIT License (MIT); see LICENSE.txt
 */

/**
 * Creates an ve.ui.MWMediaSearchWidget object.
 *
 * @class
 * @extends OO.ui.SearchWidget
 *
 * @constructor
 * @param {Object} [config] Configuration options
 * @param {number} [size] Vertical size of thumbnails
 */
ve.ui.MWMediaSearchWidget = function VeUiMWMediaSearchWidget( config ) {
	// Configuration intialization
	config = ve.extendObject( {
		'placeholder': ve.msg( 'visualeditor-media-input-placeholder' )
	}, config );

	// Parent constructor
	OO.ui.SearchWidget.call( this, config );

	// Properties
	this.sources = {};
	this.size = config.size || 150;
	this.queryTimeout = null;
	this.titles = {};
	this.queryMediaSourcesCallback = this.queryMediaSources.bind( this );

	this.sourceCounter = 0;

	this.$noItemsMessage = this.$( '<div>' )
		.addClass( 've-ui-mwMediaSearchWidget-noresults' )
		.text( ve.msg( 'visualeditor-dialog-media-noresults' ) )
		.appendTo( this.$query );

	// Events
	this.$results.on( 'scroll', this.onResultsScroll.bind( this ) );

	// Initialization
	this.$element.addClass( 've-ui-mwMediaSearchWidget' );
};

/* Inheritance */

OO.inheritClass( ve.ui.MWMediaSearchWidget, OO.ui.SearchWidget );

/* Methods */

/**
 * Set the fileRepo sources for the media search
 * @param {Object} sources The sources object
 */
ve.ui.MWMediaSearchWidget.prototype.setSources = function ( sources ) {
	this.sources = sources;
};

/**
 * Handle select widget select events.
 *
 * @param {string} value New value
 */
ve.ui.MWMediaSearchWidget.prototype.onQueryChange = function () {
	var i, len;

	// Parent method
	OO.ui.SearchWidget.prototype.onQueryChange.call( this );

	// Reset
	this.titles = {};
	for ( i = 0, len = this.sources.length; i < len; i++ ) {
		delete this.sources[i].gsroffset;
	}

	// Queue
	clearTimeout( this.queryTimeout );
	this.queryTimeout = setTimeout( this.queryMediaSourcesCallback, 100 );
};

/**
 * Handle results scroll events.
 *
 * @param {jQuery.Event} e Scroll event
 */
ve.ui.MWMediaSearchWidget.prototype.onResultsScroll = function () {
	var position = this.$results.scrollTop() + this.$results.outerHeight(),
		threshold = this.results.$element.outerHeight() - this.size;
	if ( !this.query.isPending() && position > threshold ) {
		this.queryMediaSources();
	}
};

/**
 * Query all sources for media.
 *
 * @method
 */
ve.ui.MWMediaSearchWidget.prototype.queryMediaSources = function () {
	var i, len, source,
		ajaxOptions = {},
		value = this.query.getValue();

	if ( value === '' ) {
		return;
	}

	// Reset counter
	this.sourceCounter = 0;
	this.$noItemsMessage.hide();

	for ( i = 0, len = this.sources.length; i < len; i++ ) {
		source = this.sources[i];
		// If we don't have either 'apiurl' or 'scriptDirUrl'
		// the source is invalid, and we will skip it
		if ( source.apiurl || source.scriptDirUrl !== undefined ) {
			if ( source.request ) {
				source.request.abort();
			}
			if ( !source.gsroffset ) {
				source.gsroffset = 0;
			}
			if ( source.local ) {
				ajaxOptions = {
					'url': mw.util.wikiScript( 'api' ),
					// If the url is local use json
					'dataType': 'json'
				};
			} else {
				ajaxOptions = {
					// If 'apiurl' is set, use that. Otherwise, build the url
					// from scriptDirUrl and /api.php suffix
					'url': source.apiurl || ( source.scriptDirUrl + '/api.php' ),
					// If the url is not the same origin use jsonp
					'dataType': 'jsonp',
					// JSON-P requests are not cached by default and get a &_=random trail.
					// While setting cache=true will still bypass cache in most case due to the
					// callback parameter, at least drop the &_=random trail which triggers
					// an API warning (invalid parameter).
					'cache': true
				};
			}
			this.query.pushPending();
			source.request = ve.init.target.constructor.static.apiRequest( {
				'action': 'query',
				'generator': 'search',
				'gsrsearch': value,
				'gsrnamespace': 6,
				'gsrlimit': 20,
				'gsroffset': source.gsroffset,
				'prop': 'imageinfo',
				'iiprop': 'dimensions|url|mediatype',
				'iiurlheight': this.size
			}, ajaxOptions )
				.done( this.onMediaQueryDone.bind( this, source ) )
				.always( this.onMediaQueryAlways.bind( this, source ) );
			source.value = value;
		}
	}
};

/**
 * Handle media query response events.
 *
 * @method
 * @param {Object} source Media query source
 */
ve.ui.MWMediaSearchWidget.prototype.onMediaQueryAlways = function ( source ) {
	source.request = null;
	this.query.popPending();

	// Count this source as done
	this.sourceCounter++;

	// Check if all sources are done
	// TODO use $.when() instead (bug 65321)
	if ( this.sourceCounter >= this.sources.length ) {
		if ( this.results.getItems().length === 0 ) {
			this.$noItemsMessage.show();
		}
	}

	// Even if the whole list of sources didn't finish yet
	// if there are results, make the message go away
	if ( this.results.getItems().length > 0 ) {
		this.$noItemsMessage.hide();
	}
};

/**
 * Handle media query load events.
 *
 * @method
 * @param {Object} source Media query source
 * @param {Object} data Media query response
 */
ve.ui.MWMediaSearchWidget.prototype.onMediaQueryDone = function ( source, data ) {
	if ( !data.query || !data.query.pages ) {
		return;
	}

	var page, title,
		items = [],
		pages = data.query.pages,
		value = this.query.getValue();

	if ( value === '' || value !== source.value ) {
		return;
	}

	if ( data['query-continue'] && data['query-continue'].search ) {
		source.gsroffset = data['query-continue'].search.gsroffset;
	}

	for ( page in pages ) {
		// Verify that imageinfo exists
		// In case it does not, skip the image to avoid errors in
		// ve.ui.MWMediaResultWidget
		if ( pages[page].imageinfo && pages[page].imageinfo.length > 0 ) {
			title = new mw.Title( pages[page].title ).getMainText();
			if ( !( title in this.titles ) ) {
				this.titles[title] = true;
				items.push(
					new ve.ui.MWMediaResultWidget(
						pages[page],
						{ '$': this.$, 'size': this.size }
					)
				);
			}
		}
	}

	this.results.addItems( items );
};
