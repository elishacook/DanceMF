test('sanity', function ()
{
    ok(2 + 2 != 5, 'It\'s not 1984')
    ok(typeof dmf != "undefined", 'dmf is defined')
})

module('events')

var Counter = function ()
{
    this.i = 0
    this.inc = function () { this.i++ }.bind(this)
}

test('Simple events', function ()
{
    var counter = new Counter()
    ok(counter.i == 0, 'Counter is zero')
    
    var hub = new dmf.EventHub()
    hub.on('foo', counter.inc)
    hub.fire('foo')
    equal(counter.i, 1, "Event fired once")
    
    hub.fire('foo')
    hub.fire('foo')
    equal(counter.i, 3, "Event fired twice")
    
    hub.off('foo', counter.inc)
    hub.fire('foo')
    equal(counter.i, 3, "Event fired but did not call unregistered listener")
    
    var counter2 = new Counter()
    
    hub.on('bar', counter.inc)
    hub.on('bar', counter2.inc)
    hub.fire('bar')
    ok(counter.i == 4 && counter2.i == 1, "Event fired and called 2 listeners once each")
    
    var result = 0
    hub.on('do-addition', function (a,b) { result = a+b })
    hub.fire('do-addition', 5, 23)
    equal(result, 28, 'Event passed arguments to callback')
})

test('Multiple event registration', function ()
{
    var counter = new Counter(),
        hub = new dmf.EventHub()
    
    hub.on('foo bar baz', counter.inc)
    hub.fire('foo')
    hub.fire('bar')
    hub.fire('baz')
    equal(counter.i, 3, "Called listener once for each registered event")
    
    hub.off('foo baz', counter.inc)
    hub.fire('foo')
    hub.fire('baz')
    equal(counter.i, 3, "Didn't call unregistered listeners")
    
    hub.fire('bar')
    equal(counter.i, 4, "Called listener that was still registered")
})

test('One time events', function ()
{
    var counter1 = new Counter(),
        counter2 = new Counter(),
        hub = new dmf.EventHub()
    
    hub.on('you-only-live', counter1.inc)
    hub.one('you-only-live', counter2.inc)
    
    hub.fire('you-only-live')
    hub.fire('you-only-live')
    hub.fire('you-only-live')
    
    equal(counter1.i, 3, "Called normal listener 3 times")
    equal(counter2.i, 1, "Called one-time listener once")
    
})

test('Late events', function ()
{
    var counter = new Counter(),
        hub = new dmf.EventHub()
    
    hub.fire('white-rabbit')
    equal(counter.i, 0, "Did not call unregistered listener")
    
    hub.late('white-rabbit', counter.inc)
    equal(counter.i, 1, "Called late-bound listener")
    
    hub.fire('white-rabbit')
    equal(counter.i, 2, "Called late-bound listener like a normal listener for subsequent events")
})

test('Catch-all listener', function ()
{
    var counter = new Counter(),
        hub = new dmf.EventHub()
        
    hub.all(counter.inc)
    hub.fire('there')
    hub.fire('that')
    hub.fire('is')
    hub.fire('better')
    equal(counter.i, 4, "Catch-all listener was called for 4 unregistered events")
})


module('models')

var get_ponies = function ()
{
    return [
        {
            name: 'Twilight Sparkle',
            color: 'purple',
            cutie_mark: 'star'
        },
        {
            name: 'Pinkie Pie',
            color: 'pink',
            cutie_mark: 'balloons'
        },
        {
            name: 'Rarity',
            color: 'white',
            cutie_mark: 'diamonds'
        },
        {
            name: 'Applejack',
            color: 'orange',
            cutie_mark: 'apples'
        },
        {
            name: 'Fluttershy',
            color: 'yellow',
            cutie_mark: 'butterflies'
        },
        {
            name: 'Rainbow Dash',
            color: 'blue',
            cutie_mark: 'rainbow bolt'
        }
    ]
}

test('Simple model', function ()
{
    var Pony = dmf.model.create(
    {
        name: null,
        color: null,
        cutie_mark: null
    })
    
    expect(8)
    
    deepEqual(Object.keys(Pony.schema), ['name', 'color', 'cutie_mark'], "Model has all fields defined in schema")
    
    var twilight = new Pony()
    twilight.name = 'Twilight Sparkle'
    equal(twilight.get('name'), 'Twilight Sparkle', 'Setting and getting properties works')
    
    var model = null, field_name = null
    twilight.on('change', function (m, n)
    {
        model = m
        field_name = n
    })
    twilight.color = 'purple'
    equal(model, twilight, 'Model-level notifications work')
    equal(field_name, 'color', 'Model-level notifications pass the correct field name')
    
    var counter = new Counter()
    twilight.on('change.cutie_mark', counter.inc)
    twilight.cutie_mark = 'star'
    equal(counter.i, 1, "Property-level notifications work")
    
    twilight.color = 'super friendly purple'
    equal(counter.i, 1, "Property-level notifications only fired for registered property")
    
    ok(!twilight.is_deleted, "Model not marked delete when it's not")
    
    twilight.on('delete', function ()
    {
        ok(twilight.is_deleted, "Model is marked deleted when it is")
    })
    twilight.mark_deleted()
})

test('Property validation', function ()
{
    var is_number = function (value) { return value.constructor == Number },
        Spell = dmf.model.create(
            {
                id: null,
                name: null,
                strength: is_number,
                distance: is_number,
            }
        )
    
    var spell = new Spell(),
        model = null,
        field_name = null
        
    spell.on('valid', function (m, n)
    {
        model = m
        field_name = n
    })
    spell.name = 'time travel'
    equal(model, spell, "Valid notifications work")
    equal(field_name, 'name', "Valid notifications pass correct field name")
    
    model
    
    spell.on('valid.name', function (m)
    {
        model = m
    })
    spell.name = 'time travel'
    equal(model, spell, "Property-level valid notifications work")
    
    var counter = new Counter()
    spell.on('valid.name', counter.inc)
    spell.strength = 0.5
    equal(counter.i, 0, "Property-level valid notifications only fire for registered <properties></properties>")
    
    model = field_name = null
    
    spell.on('invalid', function (m, n)
    {
        model = m
        field_name = n
    })
    spell.strength = 'you no spell good'
    equal(model, spell, "Invalid notifications work")
    equal(field_name, 'strength', "Invalid notifications pass correct field name")
    
    counter.i = 0
    spell.on('invalid.strength', counter.inc)
    spell.strength = 'you spell ok, but weak'
    equal(counter.i, 1, "Property-level invalid notification works")
    
    spell.distance = 'you no far go'
    equal(counter.i, 1, "Property-level invalid notifications only fire for registered properties")
})

test('Model cache', function ()
{
    var Pony = dmf.model.create(
        {
            name: null,
            color: null,
            cutie_mark: null
        },
        {
            primary_key: 'name'
        }
    )
    
    equal(Pony.cache.all.length, 0, "Model cache starts empty")
    
    get_ponies().map(function (fields) { new Pony(fields) })
    equal(Pony.cache.all.length, get_ponies().length, "New instances added to cache")
    
    var a = Pony.cache.get('Applejack'),
        b = Pony.cache.get('Applejack')
    
    equal(a, b, "Cache returns same instance for same id")
    
    var new_pony = new Pony()
    equal(Pony.cache.all.length, get_ponies().length, "Instance without a primary key is not added to cache")
    
    new_pony.name = 'Newbius Rex'
    equal(Pony.cache.all.length, get_ponies().length + 1, "Instance is added to cache when primary key is set")
    equal(Pony.cache.get('Newbius Rex'), new_pony, "Instance added by setting primary key can be retrieved")
    new_pony.name = 'Newbius Pest'
    notEqual(Pony.cache.get('Newbius Rex'), new_pony, "Instance with a changed primary key is not accessible by its old key")
    equal(Pony.cache.get('Newbius Pest'), new_pony, "Instance can be retrieved by its new primary key")
    
})

test('Local model storage', function ()
{
    var store = new dmf.store.LocalStore(),
        Pony = dmf.model.create(
            {
                name: null,
                color: null,
                cutie_mark: null
            },
            {
                name: 'Pony',
                primary_key: 'name'
            }
        )
    
    expect(11)
    
    store.clear(Pony, {}, function ()
    {
        store.get(Pony, {}, function (ponies, error)
        {
            equal(ponies.length, 0, "Local storage starts out empty")
        })
        
        var ponies = get_ponies().map(function (fields)
        {
            var p = new Pony(fields)
            store.create(p)
            return p
        })
        
        store.get(Pony, {}, function (all_ponies)
        {
            equal(all_ponies.length, ponies.length, "Can get all the saved instances")
        })
        
        store.get_by_id(Pony, "Fahrvergnügen", {}, function (pony)
        {
            equal(pony, null, "Nothing returned for nonexistent key")
        })
        
        var rainbow = null
        store.get_by_id(Pony, "Rainbow Dash", {}, function (pony)
        {
            equal(pony.name, "Rainbow Dash", "Can retrieve instance by primary key")
            rainbow = pony
        })
        
        equal(rainbow.color, "blue", "Fields came through serialization OK")
        ok(rainbow.is_stored, "Instance is marked as stored when retrieved")
        ok(!rainbow.is_dirty, "Instance is not marked dirty when retrieved")
        
        rainbow.color = 'blue'
        ok(!rainbow.is_dirty, "Instance is not marked dirty when setting a field to its current value")
        rainbow.color = 'light blue'
        ok(rainbow.is_dirty, "Instance is marked dirty when a field changes")
        
        store.update(rainbow, {}, function ()
        {
            ok(!rainbow.is_dirty, "Instance is not marked dirty after saving")
            
            store.get_by_id(Pony, "Rainbow Dash", {}, function (pony)
            {
                equal(pony.color, "light blue", "Overwrote existing model")
            })
        })
    })
})

asyncTest('Rest model storage', function ()
{
    var store = new dmf.store.RESTStore({
        base_url: 'http://localhost:3002/'
    })
    
    var Pony = dmf.model.create(
        {
            name: null,
            color: null,
            cutie_mark: null
        },
        {
            name: 'Pony',
            plural_name: 'Ponies',
            primary_key: 'name'
        }
    )
    
    var i=0,
        next = function ()
        {
            tests[i]()
            
            i++
            
            if (i == tests.length)
            {
                start()
            }
        },
        tests = [
            function ()
            {
                var pony = new Pony({
                    name: 'Twilight Sparkle',
                    color: 'purple',
                    cutie_mark: 'star'
                })
                
                ok(!pony.is_stored, "Instance is marked as unstored when initially created")
                
                store.create(pony, {}, function (created_pony, error)
                {
                    equal(created_pony, pony, "create() provides callback with the same instance it was passed")
                    ok(pony.is_stored, "Instance is marked as stored after saving")
                    next()
                })
            },
            function ()
            {
                store.get_by_id(Pony, 'Twilight Sparkle', {}, function (pony, error)
                {
                    equal(pony.name, "Twilight Sparkle", "Got an instance by id")
                    next()
                })
            },
            function ()
            {
                var pony = new Pony({
                    name: 'Pinkie Pie',
                    color: 'orange',
                    cutie_mark: 'balloons'
                })
                
                store.create(pony, {}, function ()
                {
                    store.get(Pony, {}, function (ponies)
                    {
                        equal(ponies.length, 2, "Got a list of instances")
                        next()
                    })
                })
            },
            function ()
            {
                store.get_by_id(Pony, 'Pinkie Pie', {}, function (pony)
                {
                    pony.color = 'pink'
                    store.update(pony, {}, function ()
                    {
                        ok(pony.is_stored, "Instance marked stored after update")
                        ok(!pony.is_dirty, "Instance is not marked dirty after update")
                        store.get_by_id(Pony, 'Pinkie Pie', {}, function (pony)
                        {
                            equal(pony.color, 'pink', 'Updated instance')
                            next()
                        })
                    })
                })
            },
            function ()
            {
                store.get_by_id(Pony, 'Pinkie Pie', {}, function (pony)
                {
                    store.delete(pony, {}, function ()
                    {
                        ok(pony.is_deleted, "Instance marked deleted after deleting")
                        store.get_by_id(Pony, 'Pinkie Pie', {}, function (pony, error)
                        {
                            equal(pony, null, "Deleted an instance")
                        })
                    })
                })
            }
        ]
        
    expect(10)
    
    store.clear(Pony, {}, function ()
    {
        next()
    })
})

module('application')

test('Sanity', function ()
{
    var app = new dmf.Application()
    
    ok(typeof app.options != 'undefined', "Has options")
    ok(typeof app.models != 'undefined', "Has models")
    ok(typeof app.views != 'undefined', "Has views")
    ok(typeof app.controllers != 'undefined', "Has controllers")
})

test('Models in app context', function ()
{
    var store = new dmf.store.LocalStore(),
        app = new dmf.Application({
            models: {
                default_store: store
            }
        })
    
    var Pony = app.models.create(
        'Pony',
        {
            name: null,
            color: null,
            cutie_mark: null
        },
        {
            plural_name: 'Ponies'
        }
    )
    
    equal(app.models.Pony, Pony, "Model added to app object on creation")
    equal(Pony.meta.store, store, "Default app store assigned to model")
})