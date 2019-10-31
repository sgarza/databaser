'use strict';

const { datatypes, model } = require( '../index.js' );

describe( 'datatypes.integer', () => {
    it( 'should have expected implementation', () => {
        expect( typeof datatypes.integer ).toEqual( 'function' );
        expect( datatypes.integer() ).toMatchObject( {
            datatype: 'integer',
            options: expect.objectContaining( {
                null: expect.any( Boolean ),
                unique: expect.any( Boolean ),
                range: expect.objectContaining( {
                    min: undefined,
                    max: undefined
                } ),
                initial: undefined,
                validate: undefined
            } ),
            initial: expect.any( Function ),
            validate: expect.any( Function )
        } );
    } );

    it( 'should not allow non number types', () => {
        const Validation = model( {
            name: 'not_a_number',
            schema: {
                val: datatypes.integer()
            }
        } );

        const good = Validation.create( {
            val: 1
        } );

        const bad = Validation.create( {
            val: 'foo'
        } );

        expect( Validation.validate( good ) ).toEqual( undefined );
        expect( Validation.validate( bad ) ).toEqual( [ 'invalid type' ] );
    } );

    it( 'should not allow floating point numbers', () => {
        const Validation = model( {
            name: 'not_floating_point',
            schema: {
                val: datatypes.integer()
            }
        } );

        const good = Validation.create( {
            val: 1
        } );

        const bad = Validation.create( {
            val: 1.1
        } );

        expect( Validation.validate( good ) ).toEqual( undefined );
        expect( Validation.validate( bad ) ).toEqual( [ 'invalid value' ] );
    } );

    it( 'should allow custom validation', () => {
        const Validation = model( {
            name: 'validation',
            schema: {
                val: datatypes.integer( {
                    validate: value => {
                        if ( value !== 1 ) {
                            return 'not 1';
                        }
                    }
                } )
            }
        } );

        const good = Validation.create( {
            val: 1
        } );

        const bad = Validation.create( {
            val: 2
        } );

        expect( Validation.validate( good ) ).toEqual( undefined );
        expect( Validation.validate( bad ) ).toEqual( [ 'not 1' ] );
    } );
} );