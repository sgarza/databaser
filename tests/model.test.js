'use strict';

const { datatypes, model } = require( '../index.js' );

describe( 'model', () => {
	it( 'should be a function', () => {
		expect( typeof model ).toEqual( 'function' );
	} );

	it( 'should throw if no name is specified', () => {
		expect( () => ( model() ) ).toThrow( 'name' );
	} );

	it( 'should throw if no schema is specified', () => {
		expect( () => ( model( {
			name: 'foo'
		} ) ) ).toThrow( 'schema' );
	} );

	it( 'should return a model when given a name and schema', () => {
		expect( model( {
			name: 'user',
			schema: {
				id: datatypes.string()
			}
		} ) ).toMatchObject( {
			options: expect.objectContaining( {
				schema: expect.objectContaining( {
					id: expect.any( Object )
				} )
			} ),
			create: expect.any( Function ),
			validate: expect.any( Function )
		} );
	} );
} );