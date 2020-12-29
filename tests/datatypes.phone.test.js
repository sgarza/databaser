'use strict';

const assert = require( 'assert' );
const { datatypes, model } = require( '../index.js' );

module.exports = async ( plaintest ) => {
	const group = plaintest.group( 'datatypes.phone' );

	group.test( 'should have expected implementation', () => {
		assert.strictEqual( typeof datatypes.phone, 'function' );

		const obj = datatypes.phone();

		assert.strictEqual( obj?.datatype, 'phone' );
		assert.deepStrictEqual( obj?.options, {
			nullable: true,
			length: {
				min: undefined,
				max: 32
			},
			unique: false,
			initial: undefined,
			validate: undefined,
			example: '+12135555555'
		} );

		assert.strictEqual( typeof obj?.initial, 'function' );
		assert.strictEqual( typeof obj?.validate, 'function' );
	} );

	group.test( 'should allow custom validation', () => {
		const Validation = model( {
			name: 'validation',
			schema: {
				val: datatypes.phone( {
					validate: ( value ) => {
						if ( value !== '+12135555555' ) {
							return 'not the right phone';
						}
					}
				} )
			}
		} );

		const good = Validation.create( {
			val: '+12135555555'
		} );

		const bad = Validation.create( {
			val: '+12135555556'
		} );

		assert.deepStrictEqual( Validation.validate( good ), [] );
		assert.deepStrictEqual( Validation.validate( bad ), [ {
			field: 'val',
			error: 'not the right phone'
		} ] );
	} );
};