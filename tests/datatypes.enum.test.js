'use strict';

const { datatypes, model } = require( '../index.js' );

describe( 'datatypes.enum', () => {
    it( 'should have expected implementation', () => {
        expect( typeof datatypes.enum ).toEqual( 'function' );
        expect( datatypes.enum() ).toMatchObject( {
            datatype: 'enum',
            options: expect.objectContaining( {
                null: expect.any( Boolean ),
                initial: undefined,
                validate: undefined,
                values: expect.any( Array )
            } ),
            initial: expect.any( Function ),
            validate: expect.any( Function )
        } );
    } );

    it( 'should validate that values are members of the enum', () => {
        const Enum = model( {
            name: 'enum',
            schema: {
                enum: datatypes.enum( {
                    values: [
                        'foo',
                        'bar',
                        'baz'
                    ]
                } )
            }
        } );

        const good = Enum.create( {
            enum: 'foo'
        } );

        const bad = Enum.create( {
            enum: 'invalid'
        } );

        expect( Enum.validate( good ) ).toEqual( undefined );
        expect( Enum.validate( bad ) ).toEqual( [ 'invalid value' ] );
    } );

    it( 'should allow additional custom validation', () => {
        const Enum = model( {
            name: 'enum',
            schema: {
                enum: datatypes.enum( {
                    values: [
                        'foo',
                        'bar',
                        'baz'
                    ],
                    validate: value => {
                        if ( value !== 'foo' ) {
                            return 'not foo';
                        }
                    }
                } )
            }
        } );

        const good = Enum.create( {
            enum: 'foo'
        } );

        const bad = Enum.create( {
            enum: 'bar'
        } );

        expect( Enum.validate( good ) ).toEqual( undefined );
        expect( Enum.validate( bad ) ).toEqual( [ 'not foo' ] );
    } );
} );