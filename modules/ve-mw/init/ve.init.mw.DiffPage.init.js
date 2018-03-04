/*!
 * VisualEditor MediaWiki DiffPage init.
 *
 * @copyright 2011-2018 VisualEditor Team and others; see AUTHORS.txt
 * @license The MIT License (MIT); see LICENSE.txt
 */

( function () {
	var reviewModeButtonSelect, diffElement, lastDiff, $wikitextDiff,
		$visualDiffContainer = $( '<div>' ),
		$visualDiff = $( '<div>' ),
		$revisionInfo = $( '<table>' ).addClass( 'diff' ),
		progress = new OO.ui.ProgressBarWidget( { classes: [ 've-init-mw-diffPage-loading' ] } ),
		uri = new mw.Uri(),
		mode = uri.query.diffmode || 'source',
		conf = mw.config.get( 'wgVisualEditorConfig' ),
		pluginModules = conf.pluginModules.filter( mw.loader.getState );

	if ( mode !== 'visual' ) {
		// Enforce a valid mode, to avoid visual glitches in button-selection.
		mode = 'source';
	}

	$visualDiffContainer.append(
		$revisionInfo,
		progress.$element.addClass( 'oo-ui-element-hidden' ),
		$visualDiff
	);

	function onReviewModeButtonSelectSelect( item ) {
		var modulePromise, oldPageName, newPageName, isVisual,
			$revSlider = $( '.mw-revslider-container' ),
			oldId = mw.config.get( 'wgDiffOldId' ),
			newId = mw.config.get( 'wgDiffNewId' );

		if ( mw.config.get( 'wgCanonicalSpecialPageName' ) !== 'ComparePages' ) {
			oldPageName = newPageName = mw.config.get( 'wgRelevantPageName' );
		} else {
			oldPageName = uri.query.page1;
			newPageName = uri.query.page2;
		}

		mode = item.getData();
		isVisual = mode === 'visual';

		$visualDiffContainer.toggleClass( 'oo-ui-element-hidden', !isVisual );
		$wikitextDiff.toggleClass( 'oo-ui-element-hidden', isVisual );
		$revSlider.toggleClass( 've-init-mw-diffPage-revSlider-visual', isVisual );

		if ( isVisual && !(
			lastDiff && lastDiff.oldId === oldId && lastDiff.newId === newId &&
			lastDiff.oldPageName === oldPageName && lastDiff.newPageName === newPageName
		) ) {
			$visualDiff.empty();
			progress.$element.removeClass( 'oo-ui-element-hidden' );
			// TODO: Load a smaller subset of VE for computing the visual diff
			modulePromise = mw.loader.using( [ 'ext.visualEditor.desktopArticleTarget' ].concat( pluginModules ) );
			mw.libs.ve.diffLoader.getVisualDiffGeneratorPromise( oldId, newId, modulePromise, oldPageName, newPageName ).then( function ( visualDiffGenerator ) {
				diffElement = new ve.ui.DiffElement( visualDiffGenerator(), { classes: [ 've-init-mw-diffPage-diff' ] } );

				progress.$element.addClass( 'oo-ui-element-hidden' );
				$visualDiff.append( diffElement.$element );
				lastDiff = {
					oldId: oldId,
					newId: newId,
					oldPageName: oldPageName,
					newPageName: newPageName
				};

				diffElement.positionDescriptions();
			} );
		}

		if ( history.replaceState ) {
			uri.query.diffmode = mode;
			history.replaceState( '', document.title, uri );
		}

	}

	mw.hook( 'wikipage.diff' ).add( function () {
		$wikitextDiff = $( 'table.diff[data-mw="interface"]' );
		$wikitextDiff.before( $visualDiffContainer );
		$revisionInfo.empty().append(
			// Clone with `true, true` to also deep clone event handlers, e.g. for the "thanks" link.
			$( 'tr.diff-title' ).clone( true, true )
		);
		// Highlight the headers using the same styles as the diff, to better indicate
		// the meaning of headers when not using two-column diff.
		$revisionInfo.find( '#mw-diff-otitle1' ).attr( 'data-diff-action', 'remove' );
		$revisionInfo.find( '#mw-diff-ntitle1' ).attr( 'data-diff-action', 'insert' );

		// The PHP widget was a ButtonGroupWidget, so replace with a
		// ButtonSelectWidget instead of infusing.
		reviewModeButtonSelect = new OO.ui.ButtonSelectWidget( {
			items: [
				new OO.ui.ButtonOptionWidget( { data: 'visual', icon: 'eye', label: mw.msg( 'visualeditor-savedialog-review-visual' ) } ),
				new OO.ui.ButtonOptionWidget( { data: 'source', icon: 'wikiText', label: mw.msg( 'visualeditor-savedialog-review-wikitext' ) } )
			]
		} );
		reviewModeButtonSelect.on( 'select', onReviewModeButtonSelectSelect );
		$( '.ve-init-mw-diffPage-diffMode' ).empty().append( reviewModeButtonSelect.$element );
		reviewModeButtonSelect.selectItemByData( mode );
	} );
}() );
