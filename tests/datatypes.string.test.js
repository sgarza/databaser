'use strict';

const assert = require( 'assert' );
const { datatypes, model } = require( '../index.js' );

module.exports = async ( plaintest ) => {
	const group = plaintest.group( 'datatypes.string' );

	group.test( 'should have expected implementation', () => {
		assert.strictEqual( typeof datatypes.string, 'function' );

		const obj = datatypes.string();

		assert.strictEqual( obj?.datatype, 'string' );
		assert.deepStrictEqual( obj?.options, {
			nullable: true,
			length: {
				min: undefined,
				max: undefined
			},
			unique: false,
			initial: undefined,
			validate: undefined,
			example: 'hello'
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
						if ( value !== 'foo' ) {
							return 'not foo';
						}
					}
				} )
			}
		} );

		const good = Validation.create( {
			val: 'foo'
		} );

		const bad = Validation.create( {
			val: 'bar'
		} );

		assert.deepStrictEqual( Validation.validate( good ), [] );
		assert.deepStrictEqual( Validation.validate( bad ), [ {
			field: 'val',
			error: 'not foo'
		} ] );
	} );
};