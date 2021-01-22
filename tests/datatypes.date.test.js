'use strict';

const assert = require( 'assert' );
const { datatypes, model } = require( '../index.js' );

module.exports = async ( plaintest ) => {
	const group = plaintest.group( 'datatypes.date' );

	group.test( 'should have expected implementation', () => {
		assert.strictEqual( typeof datatypes.date, 'function' );

		const obj = datatypes.date();

		assert.strictEqual( obj?.datatype, 'date' );
		assert.deepStrictEqual( obj?.options, {
			nullable: true,
			unique: false,
			initial: undefined,
			validate: undefined,
			length: {
				min: 10,
				max: 10
			},
			example: '2021-01-21'
		} );

		assert.strictEqual( typeof obj?.initial, 'function' );
		assert.strictEqual( typeof obj?.validate, 'function' );
	} );

	group.test( 'should allow custom validation', () => {
		const Validation = model( {
			name: 'validation',
			schema: {
				val: datatypes.date( {
					validate: ( value ) => {
						if ( value !== '2020-12-28' ) {
							return 'wrong date';
						}
					}
				} )
			}
		} );

		const good = Validation.create( {
			val: '2020-12-28'
		} );

		const bad = Validation.create( {
			val: '2019-12-28'
		} );

		assert.deepStrictEqual( Validation.validate( good ), [] );
		assert.deepStrictEqual( Validation.validate( bad ), [ {
			field: 'val',
			error: 'wrong date'
		} ] );
	} );
};