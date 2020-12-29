'use strict';

const assert = require( 'assert' );
const { datatypes, model } = require( '../index.js' );

module.exports = async ( plaintest ) => {
	const group = plaintest.group( 'datatypes.ISODate' );

	group.test( 'should have expected implementation', () => {
		assert.strictEqual( typeof datatypes.ISODate, 'function' );

		const obj = datatypes.ISODate();

		assert.strictEqual( obj?.datatype, 'ISODate' );
		assert.deepStrictEqual( obj?.options, {
			nullable: true,
			unique: false,
			initial: undefined,
			validate: undefined,
			example: '2020-10-21T03:53:01.873Z'
		} );

		assert.strictEqual( typeof obj?.initial, 'function' );
		assert.strictEqual( typeof obj?.validate, 'function' );
	} );

	group.test( 'should allow custom validation', () => {
		const Validation = model( {
			name: 'validation',
			schema: {
				val: datatypes.ISODate( {
					validate: ( value ) => {
						if ( value !== '2020-12-28T00:00:00.000Z' ) {
							return 'wrong date';
						}
					}
				} )
			}
		} );

		const good = Validation.create( {
			val: '2020-12-28T00:00:00.000Z'
		} );

		const bad = Validation.create( {
			val: '2019-12-28T00:00:00.000Z'
		} );

		assert.deepStrictEqual( Validation.validate( good ), [] );
		assert.deepStrictEqual( Validation.validate( bad ), [ {
			field: 'val',
			error: 'wrong date'
		} ] );
	} );
};