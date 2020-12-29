'use strict';

const assert = require( 'assert' );
const { datatypes, model } = require( '../index.js' );

module.exports = async ( plaintest ) => {
	const group = plaintest.group( 'datatypes.UUID' );

	group.test( 'should have expected implementation', () => {
		assert.strictEqual( typeof datatypes.UUID, 'function' );

		const obj = datatypes.UUID();

		assert.strictEqual( obj?.datatype, 'UUID' );
		assert.deepStrictEqual( obj?.options, {
			nullable: true,
			unique: false,
			initial: undefined,
			validate: undefined,
			example: '8bb846ee-a778-4378-9635-34b54956675d'
		} );

		assert.strictEqual( typeof obj?.initial, 'function' );
		assert.strictEqual( typeof obj?.validate, 'function' );
	} );

	group.test( 'should allow custom validation', () => {
		const Validation = model( {
			name: 'validation',
			schema: {
				val: datatypes.string( {
					validate: ( value ) => {
						if ( value !== '61749346-cddb-42b9-ac75-42f73242f6a8' ) {
							return 'not correct';
						}
					}
				} )
			}
		} );

		const good = Validation.create( {
			val: '61749346-cddb-42b9-ac75-42f73242f6a8'
		} );

		const bad = Validation.create( {
			val: '12a1e890-fd7f-40a9-bad1-bbc4f2f39ff9'
		} );

		assert.deepStrictEqual( Validation.validate( good ), [] );
		assert.deepStrictEqual( Validation.validate( bad ), [ {
			field: 'val',
			error: 'not correct'
		} ] );
	} );
};