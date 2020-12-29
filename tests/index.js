const plaintest = require( 'plaintest' );

const tests = require( 'require-all' )( {
	dirname: __dirname,
	filter: /(.+)\.test\.js$/,
	recursive: true
} );

( async function() {
	plaintest.headline( 'databaser' );

	for ( const test of Object.values( tests ) ) {
		if ( typeof test !== 'function' ) {
			continue;
		}

		await test( plaintest );
	}

	await plaintest.run();
} )();
