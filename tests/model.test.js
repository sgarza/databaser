'use strict';

const assert = require( 'assert' );
const { datatypes, model } = require( '../index.js' );

module.exports = async ( plaintest ) => {
	const group = plaintest.group( 'model' );

	group.test( 'should be a function', () => {
		assert.strictEqual( typeof model, 'function' );
	} );

	group.test( 'should throw if no name is specified', () => {
		assert.throws( () => {
			model();
		}, {
			name: 'Error',
			message: 'You must specify a name to create a model.'
		} );
	} );

	group.test( 'should throw if no schema is specified', () => {
		assert.throws( () => {
			model( {
				name: 'foo'
			} );
		}, {
			name: 'Error',
			message: 'You must specify a schema to create a model.'
		} );
	} );

	group.test( 'should return a model when given a name and schema', () => {
		const id = datatypes.string();
		const obj = model( {
			name: 'user',
			schema: {
				id
			}
		} );
		
		assert.strictEqual( typeof obj?.create, 'function' );
		assert.strictEqual( typeof obj?.validate, 'function' );
		assert.deepStrictEqual( obj?.options, {
			name: 'user',
			schema: {
				id
			}
		} );
	} );
};